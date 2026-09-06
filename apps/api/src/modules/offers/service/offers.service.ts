import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { PricingService } from '../../pricing/service/pricing.service';
import { SettingsService } from '../../settings/service/settings.service';
import {
  DuplicateOfferDto,
  GenerateOfferDto,
  OfferDraftDto,
  UpdateOfferTemplateDto,
} from '../dto/offers.dto';
import { OfferRecord } from '../interfaces/offers-prisma.interface';
import { OfferItemIdentityError, resolveOfferItemIdentity } from '../offers.external-identity';
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

  async updateTemplate(id: string, dto: UpdateOfferTemplateDto) {
    await this.offersRepository.ensureOfficialTemplates();
    const template = await this.offersRepository.findTemplate(id);
    if (!template) {
      throw new NotFoundException('Template comercial nao encontrado.');
    }

    return this.offersRepository.updateTemplateContent(id, dto.content);
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
    if (!dto.productId) {
      return this.generateExternal(dto, user);
    }
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
      identity: { productId: pricing.productId },
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

  /**
   * Persists an OfferDraft whose commercial values have already been approved
   * by Pricing. This is intentionally separate from the public generate
   * endpoint: it never reads or recalculates Pricing again.
   */
  async persistPricedOfferDraft(draft: OfferDraftDto, user: AuthenticatedUser) {
    await this.offersRepository.ensureOfficialTemplates();

    let identity;
    try {
      identity = resolveOfferItemIdentity({
        productId: draft.payload.productId,
        externalIdentity: draft.payload.externalIdentity,
      });
    } catch (error) {
      if (error instanceof OfferItemIdentityError) {
        throw new BadRequestException('Oferta externa exige origin, provider e sourceProductId.');
      }
      throw error;
    }

    if (!isCentSafe(draft.payload.salePrice) || !isCentSafe(draft.payload.offerPrice)) {
      throw new BadRequestException('OfferDraft precificado exige valores monetarios em centavos.');
    }

    const [settings, template] = await Promise.all([
      this.settingsService.getSettings(),
      this.resolveTemplate(undefined, draft.productType ?? 'IPHONE_SEALED'),
    ]);
    const sourceName =
      identity.kind === 'EXTERNAL'
        ? (identity.externalIdentity.sourceName ?? draft.payload.productName)
        : draft.payload.productName;
    const message = renderTemplate(template.content, {
      produto: sourceName,
      modelo: sourceName,
      cor: draft.payload.color,
      capacidade: draft.payload.capacity,
      preco: this.formatCurrency(draft.payload.salePrice),
      preco_oferta: this.formatCurrency(draft.payload.offerPrice),
      prazo: draft.payload.deliveryTime || settings.offers.defaultDeadline,
      garantia: draft.payload.warranty || settings.offers.defaultWarranty,
    });
    const offer = await this.offersRepository.createOffer({
      identity,
      commercialTemplateId: template.id,
      message,
      salePrice: draft.payload.salePrice,
      offerPrice: draft.payload.offerPrice,
      userId: user.id,
    });
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: offer.id,
      newValue: offer,
      context: {
        event: 'offers.persisted_priced_draft',
        source: draft.source ?? null,
        identity: identity.kind,
        productId: identity.kind === 'CANONICAL' ? identity.productId : null,
        origin: identity.kind === 'EXTERNAL' ? identity.externalIdentity.origin : null,
        provider: identity.kind === 'EXTERNAL' ? identity.externalIdentity.provider : null,
        sourceProductId:
          identity.kind === 'EXTERNAL' ? identity.externalIdentity.sourceProductId : null,
      },
    });
    return this.toResponse(offer);
  }

  private async generateExternal(dto: GenerateOfferDto, user: AuthenticatedUser) {
    let identity;
    try {
      identity = resolveOfferItemIdentity({ externalIdentity: dto.externalIdentity });
    } catch (error) {
      if (error instanceof OfferItemIdentityError) {
        throw new BadRequestException('Oferta externa exige origin, provider e sourceProductId.');
      }
      throw error;
    }
    if (identity.kind !== 'EXTERNAL') {
      throw new BadRequestException('Identidade externa invalida.');
    }
    if (!isCentSafe(dto.salePrice) || !isCentSafe(dto.offerPrice)) {
      throw new BadRequestException(
        'Oferta externa exige precos monetarios aprovados em centavos.',
      );
    }

    const [settings, template] = await Promise.all([
      this.settingsService.getSettings(),
      this.resolveTemplate(dto.templateId, dto.productType ?? 'IPHONE_SEALED'),
    ]);
    const sourceName =
      identity.externalIdentity.sourceName ?? identity.externalIdentity.sourceProductId;
    const message = renderTemplate(template.content, {
      produto: sourceName,
      modelo: sourceName,
      cor: dto.color ?? '',
      capacidade: dto.capacity ?? '',
      preco: this.formatCurrency(dto.salePrice),
      preco_oferta: this.formatCurrency(dto.offerPrice),
      prazo: settings.offers.defaultDeadline,
      garantia: settings.offers.defaultWarranty,
    });
    const offer = await this.offersRepository.createOffer({
      identity,
      commercialTemplateId: template.id,
      message,
      salePrice: dto.salePrice,
      offerPrice: dto.offerPrice,
      userId: user.id,
    });
    await this.offersRepository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: offer.id,
      newValue: offer,
      context: {
        event: 'offers.generated_external',
        origin: identity.externalIdentity.origin,
        provider: identity.externalIdentity.provider,
        sourceProductId: identity.externalIdentity.sourceProductId,
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
    return 'IPHONE_SEALED';
  }

  private toResponse(offer: OfferRecord) {
    const product = offer.items?.[0]?.product;

    return {
      id: offer.id,
      template: offer.commercialTemplate,
      message: offer.message,
      status: offer.status,
      salePrice: Number(offer.salePrice),
      offerPrice: Number(offer.offerPrice),
      whatsappUrl: getWhatsappShareLink(offer.message),
      productId: offer.items?.[0]?.productId ?? null,
      externalIdentity:
        offer.items?.[0]?.productId || !offer.items?.[0]
          ? null
          : {
              origin: offer.items[0].externalOrigin ?? null,
              provider: offer.items[0].externalProvider ?? null,
              sourceProductId: offer.items[0].externalSourceProductId ?? null,
              sourceName: offer.items[0].externalSourceName ?? null,
              sourceUrl: offer.items[0].externalSourceUrl ?? null,
              retailer: offer.items[0].externalRetailer ?? null,
            },
      product: product
        ? {
            id: product.id,
            name: product.productDescription ?? product.model?.name ?? '',
            model: product.model?.name ?? null,
            color: product.color?.name ?? null,
          }
        : null,
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

function isCentSafe(value: number | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * 100
  );
}
