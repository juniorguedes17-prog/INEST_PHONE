import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  CommercialTemplateRecord,
  OfferRecord,
  OffersPrismaClient,
} from '../interfaces/offers-prisma.interface';
import {
  legacyTemplateNames,
  offerVariables,
  officialTemplates,
} from '../templates/official-templates';

@Injectable()
export class OffersRepository {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  listTemplates() {
    return this.prisma.commercialTemplate.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  findTemplate(id: string) {
    return this.prisma.commercialTemplate.findFirst({
      where: { id, deletedAt: null, status: 'ACTIVE' },
    });
  }

  findTemplateByProductType(productType: string) {
    return this.prisma.commercialTemplate.findFirst({
      where: { productType, deletedAt: null, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async ensureOfficialTemplates() {
    await this.prisma.commercialTemplate.updateMany({
      where: { name: { in: legacyTemplateNames }, deletedAt: null, status: 'ACTIVE' },
      data: { status: 'INACTIVE' },
    });

    const templates: CommercialTemplateRecord[] = [];
    for (const template of officialTemplates) {
      templates.push(
        await this.prisma.commercialTemplate.upsert({
          where: { name: template.name },
          update: {
            productType: template.productType,
            variables: offerVariables,
            status: 'ACTIVE',
          },
          create: {
            name: template.name,
            productType: template.productType,
            content: template.content,
            variables: offerVariables,
            status: 'ACTIVE',
          },
        }),
      );
    }
    return templates;
  }

  updateTemplateContent(id: string, content: string) {
    return this.prisma.commercialTemplate.update({
      where: { id },
      data: { content },
    });
  }

  listOffers() {
    return this.prisma.offer.findMany({
      where: { deletedAt: null },
      include: { commercialTemplate: true, items: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOffer(id: string) {
    return this.prisma.offer.findUnique({
      where: { id },
      include: { commercialTemplate: true, items: true },
    });
  }

  createOffer(data: {
    productId: string;
    commercialTemplateId: string;
    message: string;
    salePrice: number;
    offerPrice: number;
    userId?: string | null;
  }) {
    return this.prisma.offer.create({
      data: {
        commercialTemplateId: data.commercialTemplateId,
        message: data.message,
        status: 'GENERATED',
        salePrice: data.salePrice,
        offerPrice: data.offerPrice,
        createdBy: data.userId,
        updatedBy: data.userId,
        items: {
          create: {
            productId: data.productId,
            salePrice: data.salePrice,
            offerPrice: data.offerPrice,
          },
        },
      },
      include: { commercialTemplate: true, items: true },
    });
  }

  duplicateOffer(offer: OfferRecord, userId?: string | null) {
    const productId = offer.items?.[0]?.productId;
    return this.prisma.offer.create({
      data: {
        commercialTemplateId: offer.commercialTemplateId,
        message: offer.message,
        status: 'GENERATED',
        salePrice: offer.salePrice,
        offerPrice: offer.offerPrice,
        createdBy: userId,
        updatedBy: userId,
        items: productId
          ? {
              create: {
                productId,
                salePrice: offer.salePrice,
                offerPrice: offer.offerPrice,
              },
            }
          : undefined,
      },
      include: { commercialTemplate: true, items: true },
    });
  }

  softDeleteOffer(id: string, userId?: string | null) {
    return this.prisma.offer.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'CANCELED', updatedBy: userId },
      include: { commercialTemplate: true, items: true },
    });
  }

  createAuditLog(data: {
    userId?: string | null;
    operationType: 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT';
    entityId?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
    context?: Record<string, unknown>;
  }) {
    return this.prisma.auditLog?.create({
      data: { entity: 'offers', ...data },
    });
  }

  private get prisma(): OffersPrismaClient {
    return this.prismaService as unknown as OffersPrismaClient;
  }
}
