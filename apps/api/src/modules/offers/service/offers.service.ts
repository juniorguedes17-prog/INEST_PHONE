import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PricingService } from '../../pricing/service/pricing.service';
import { SettingsService } from '../../settings/service/settings.service';
import { DuplicateOfferDto, GenerateOfferDto } from '../dto/offers.dto';
import { OfferRecord } from '../interfaces/offers-prisma.interface';
import { OffersRepository } from '../repository/offers.repository';
import { getWhatsappShareLink, renderTemplate } from '../validators/offers.validators';

@Injectable()
export class OffersService {
  constructor(
    @Inject(OffersRepository) private readonly offersRepository: OffersRepository,
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(SettingsService) private readonly settingsService: SettingsService,
  ) {}

  async templates() {
    await this.offersRepository.ensureOfficialTemplates();
    return this.offersRepository.listTemplates();
  }

  async list() {
    const offers = await this.offersRepository.listOffers();
    return offers.map((offer) => this.toResponse(offer));
  }

  async findOne(id: string) {
    const offer = await this.offersRepository.findOffer(id);
    if (!offer || offer.deletedAt) {
      throw new NotFoundException('Oferta nao encontrada.');
    }
    return this.toResponse(offer);
  }

  async generate(dto: GenerateOfferDto, user: AuthenticatedUser) {
    await this.offersRepository.ensureOfficialTemplates();
    const [pricing, settings] = await Promise.all([
      this.pricingService.findOne(dto.productId),
      this.settingsService.getSettings(),
    ]);
    const template = await this.resolveTemplate(dto.templateId, pricing.productType);
    const message = renderTemplate(template.content, {
      produto: pricing.productName,
      modelo: pricing.model,
      cor: pricing.color,
      capacidade: pricing.capacity,
      preco: this.formatCurrency(pricing.salePrice),
      preco_oferta: this.formatCurrency(pricing.offerPrice),
      prazo: pricing.deliveryTime || settings.offers.defaultDeadline,
      garantia: settings.offers.defaultWarranty,
    });

    const offer = await this.offersRepository.createOffer({
      productId: pricing.productId,
      commercialTemplateId: template.id,
      message,
      salePrice: pricing.salePrice,
      offerPrice: pricing.offerPrice,
      userId: user.id,
    });

    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: offer.id,
      newValue: offer,
      context: {
        event: 'offers.generated',
        productId: pricing.productId,
        templateId: template.id,
      },
    });

    return this.toResponse(offer);
  }

  async duplicate(id: string, dto: DuplicateOfferDto, user: AuthenticatedUser) {
    const current = await this.offersRepository.findOffer(id);
    if (!current || current.deletedAt) {
      throw new NotFoundException('Oferta nao encontrada.');
    }
    const duplicated = await this.offersRepository.duplicateOffer(current, user.id);
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: duplicated.id,
      oldValue: current,
      newValue: duplicated,
      context: { event: 'offers.duplicated', reason: dto.reason },
    });
    return this.toResponse(duplicated);
  }

  async softDelete(id: string, user: AuthenticatedUser) {
    const current = await this.offersRepository.findOffer(id);
    if (!current || current.deletedAt) {
      throw new NotFoundException('Oferta nao encontrada.');
    }
    const deleted = await this.offersRepository.softDeleteOffer(id, user.id);
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'DELETE',
      entityId: id,
      oldValue: current,
      newValue: deleted,
      context: { event: 'offers.soft_deleted' },
    });
    return this.toResponse(deleted);
  }

  async registerCopy(id: string, user: AuthenticatedUser) {
    const offer = await this.offersRepository.findOffer(id);
    if (!offer || offer.deletedAt) {
      throw new NotFoundException('Oferta nao encontrada.');
    }
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'EXPORT',
      entityId: id,
      context: { event: 'offers.copied' },
    });
    return { success: true };
  }

  async registerShare(id: string, user: AuthenticatedUser) {
    const offer = await this.offersRepository.findOffer(id);
    if (!offer || offer.deletedAt) {
      throw new NotFoundException('Oferta nao encontrada.');
    }
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'EXPORT',
      entityId: id,
      context: { event: 'offers.shared_whatsapp' },
    });
    return { whatsappUrl: getWhatsappShareLink(offer.message) };
  }

  private async resolveTemplate(templateId: string | undefined, productType: string) {
    const template = templateId
      ? await this.offersRepository.findTemplate(templateId)
      : await this.offersRepository.findTemplateByProductType(
          this.resolveTemplateProductType(productType),
        );

    if (template) {
      return template;
    }

    const templates = await this.offersRepository.listTemplates();
    const fallback = templates[0];
    if (!fallback) {
      throw new NotFoundException('Template comercial nao encontrado.');
    }
    return fallback;
  }

  private resolveTemplateProductType(productType: string) {
    if (productType === 'IPHONE_USED' || productType === 'APPLE_CPO') {
      return 'IPHONE_USED';
    }
    if (productType === 'IPHONE_SEALED') {
      return 'IPHONE_SEALED';
    }
    return 'ACCESSORY';
  }

  private toResponse(offer: OfferRecord) {
    return {
      id: offer.id,
      template: offer.commercialTemplate,
      message: offer.message,
      status: offer.status,
      salePrice: Number(offer.salePrice),
      offerPrice: Number(offer.offerPrice),
      whatsappUrl: getWhatsappShareLink(offer.message),
      productId: offer.items?.[0]?.productId ?? null,
      createdAt: offer.createdAt,
    };
  }

  private formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  }
}
