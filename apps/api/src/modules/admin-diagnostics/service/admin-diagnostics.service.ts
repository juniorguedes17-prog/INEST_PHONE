import { Inject, Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { deriveCanonicalVariantIdentity } from '@inest/product-identity';
import { PrismaService } from '../../../prisma/prisma.service';

const activeWhere = {
  active: true,
  status: ProductStatus.ACTIVE,
  deletedAt: null,
} as const;

const productSelect = {
  id: true,
  profitProductId: true,
  productDescription: true,
  active: true,
  status: true,
  deletedAt: true,
  productType: true,
  profitCondition: true,
  category: { select: { name: true } },
  model: { select: { name: true } },
  color: { select: { name: true } },
  storage: { select: { displayName: true, value: true, unit: true } },
} as const;

type ProductRecord = Awaited<ReturnType<AdminDiagnosticsService['loadActiveProducts']>>[number];

type IdentityLabel = 'VALID' | 'INSUFFICIENT' | 'UNRESOLVED' | 'AMBIGUOUS';

@Injectable()
export class AdminDiagnosticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async readiness() {
    const [productsTotal, productsActive, activeProducts] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.product.count({ where: activeWhere }),
      this.loadActiveProducts(),
    ]);

    const audited = activeProducts.map((product) => ({
      product,
      identity: deriveCanonicalVariantIdentity(this.identityInput(product)),
    }));
    const identity = { valid: 0, insufficient: 0, unresolved: 0, ambiguous: 0 };
    const byCanonicalKey = new Map<string, Set<string>>();

    audited.forEach(({ product, identity: resolved }) => {
      const label = this.classify(resolved.status, resolved.canonicalModelKey);
      identity[label.toLowerCase() as keyof typeof identity] += 1;
      if (resolved.key) {
        const ids = byCanonicalKey.get(resolved.key) ?? new Set<string>();
        ids.add(product.id);
        byCanonicalKey.set(resolved.key, ids);
      }
    });

    const canonicalCollisions = [...byCanonicalKey.values()].filter((ids) => ids.size > 1).length;
    const id61 = await this.findByProfitProductId(61);
    const id62 = await this.findByProfitProductId(62);
    const id67 = await this.findByProfitProductId(67);
    const neo256 = this.findMatching(activeProducts, ['macbook neo', '256']);
    const neo512 = this.findMatching(activeProducts, ['macbook neo', '512']);
    const air256 = this.findMatching(activeProducts, ['iphone', 'air', '256']);
    const air512 = this.findMatching(activeProducts, ['iphone', 'air', '512']);
    const charger = this.findMatching(activeProducts, ['carregador', '20w', 'usb-c']);
    const cable = this.findMatching(activeProducts, ['cabo', 'usb-c']);

    const blockers = [
      ...(identity.insufficient ? [`${identity.insufficient} active Product(s) with insufficient identity`] : []),
      ...(identity.unresolved ? [`${identity.unresolved} active Product(s) unresolved`] : []),
      ...(identity.ambiguous ? [`${identity.ambiguous} active Product(s) with ambiguous identity`] : []),
      ...(canonicalCollisions ? [`${canonicalCollisions} canonical collision(s) among active Products`] : []),
      ...(this.checkWatch(id61, 'apple-watch-series-11-42', '42mm') ? [] : ['profitProductId 61 failed identity check']),
      ...(this.checkWatch(id62, 'apple-watch-series-11-46', '46mm') ? [] : ['profitProductId 62 failed identity check']),
      ...(id67 && this.isActive(id67) ? ['profitProductId 67 is active'] : []),
      ...(this.checkMacBook(neo256, '256GB') ? [] : ['MacBook Neo 256GB failed identity check']),
      ...(this.checkMacBook(neo512, '512GB') ? [] : ['MacBook Neo 512GB failed identity check']),
      ...(air256 && air512 ? [] : ['iPhone 17 Air 256GB/512GB check failed']),
      ...(charger ? [] : ['Carregador Apple 20W USB-C not found among active Products']),
      ...(cable ? [] : ['Cabo Apple USB-C not found among active Products']),
    ];

    return {
      productsTotal,
      productsActive,
      productsInactive: productsTotal - productsActive,
      identity,
      canonicalCollisions,
      checks: {
        id61: this.checkRecord(id61, 'apple-watch-series-11-42', '42mm'),
        id62: this.checkRecord(id62, 'apple-watch-series-11-46', '46mm'),
        id67: id67
          ? { productId: id67.id, active: id67.active, status: id67.status, deletedAt: id67.deletedAt, participatesInActive: this.isActive(id67) }
          : { status: 'NOT_FOUND', participatesInActive: false },
        macbookNeo256: this.checkMacBook(neo256, '256GB'),
        macbookNeo512: this.checkMacBook(neo512, '512GB'),
        iphone17Air: air256 && air512 ? 'PASS' : 'FAIL',
        charger20w: charger ? 'PASS' : 'FAIL',
        cableUsbc: cable ? 'PASS' : 'FAIL',
      },
      ...(blockers.length ? { blockers } : {}),
      vm1: blockers.length ? 'BLOCKED' : 'RELEASED',
    };
  }

  async loadActiveProducts() {
    return this.prisma.product.findMany({ where: activeWhere, select: productSelect });
  }

  private async findByProfitProductId(profitProductId: number) {
    return this.prisma.product.findUnique({ where: { profitProductId }, select: productSelect });
  }

  private identityInput(product: ProductRecord) {
    return {
      productDescription: product.productDescription,
      category: product.category?.name,
      model: product.model?.name,
      color: product.color?.name,
      capacity: product.storage?.displayName ?? product.storage?.value,
      quality: product.profitCondition,
      productType: product.productType,
    };
  }

  private classify(status: string, canonicalModelKey: string | null): IdentityLabel {
    if (status === 'valid') return 'VALID';
    if (status === 'ambiguous_identity') return 'AMBIGUOUS';
    return canonicalModelKey ? 'INSUFFICIENT' : 'UNRESOLVED';
  }

  private findMatching(products: ProductRecord[], terms: string[]) {
    return products.find((product) => {
      const text = [product.productDescription, product.model?.name, product.storage?.displayName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return terms.every((term) => text.includes(term.toLowerCase()));
    }) ?? null;
  }

  private audit(product: ProductRecord | null) {
    return product
      ? { product, identity: deriveCanonicalVariantIdentity(this.identityInput(product)) }
      : null;
  }

  private checkRecord(product: ProductRecord | null, model: string, screen: string) {
    const audited = this.audit(product);
    if (!audited) return { status: 'NOT_FOUND', pass: false };
    return {
      productId: audited.product.id,
      profitProductId: audited.product.profitProductId,
      productDescription: audited.product.productDescription,
      active: audited.product.active,
      status: audited.product.status,
      deletedAt: audited.product.deletedAt,
      canonicalModelKey: audited.identity.canonicalModelKey,
      screen: audited.identity.canonicalScreen,
      connectivity: audited.identity.canonicalConnectivity,
      condition: audited.identity.canonicalCondition,
      identityStatus: this.classify(audited.identity.status, audited.identity.canonicalModelKey),
      pass: this.checkWatch(product, model, screen),
    };
  }

  private checkWatch(product: ProductRecord | null, model: string, screen: string) {
    const audited = this.audit(product);
    return Boolean(
      audited &&
        this.classify(audited.identity.status, audited.identity.canonicalModelKey) === 'VALID' &&
        audited.identity.canonicalModelKey === model &&
        audited.identity.canonicalScreen === screen &&
        audited.identity.canonicalConnectivity === 'GPS',
    );
  }

  private checkMacBook(product: ProductRecord | null, storage: string) {
    const audited = this.audit(product);
    return Boolean(
      audited &&
        this.classify(audited.identity.status, audited.identity.canonicalModelKey) === 'VALID' &&
        audited.identity.canonicalModelKey === 'macbook-neo-13' &&
        audited.identity.canonicalChip === 'A18' &&
        audited.identity.attributes.chipVariant === 'pro' &&
        audited.identity.canonicalScreen === '13"' &&
        audited.identity.canonicalRam === '8GB' &&
        audited.identity.canonicalStorage === storage &&
        audited.product.profitCondition === 'NOVO',
    );
  }

  private isActive(product: ProductRecord) {
    return product.active && product.status === ProductStatus.ACTIVE && product.deletedAt === null;
  }
}
