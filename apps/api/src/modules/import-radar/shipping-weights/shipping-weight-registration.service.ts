import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { deriveExtendedProductIdentity } from '@inest/product-identity';
import { formatSourceDisplayName } from '../source-display-name';
import { isReservedAppleManufacturerAlias } from '../../manufacturers/manufacturer-alias-normalizer';
import type { ManufacturerResolution } from '../../manufacturers/manufacturer-resolver';
import { ManufacturersService } from '../../manufacturers/service/manufacturers.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import type {
  ShippingWeightKeyInput,
  ShippingWeightManufacturerResolution,
  ShippingWeightResolution,
} from './shipping-weight.contract';
import type { RegisterShippingWeightDto } from './shipping-weight-registration.dto';
import { ShippingWeightService, normalizeShippingWeightLbs } from './shipping-weight.service';

@Injectable()
export class ShippingWeightRegistrationService {
  constructor(
    @Inject(ShippingWeightService) private readonly shippingWeightService: ShippingWeightService,
    @Inject(ManufacturersService) private readonly manufacturersService: ManufacturersService,
  ) {}

  async register(dto: RegisterShippingWeightDto, user: AuthenticatedUser) {
    const keyInput = await this.buildKeyInput(dto);
    const resolution = await this.shippingWeightService.resolveWeight(keyInput);
    return this.registerResolvedWeight(resolution, dto, user);
  }

  private async registerResolvedWeight(
    resolution: ShippingWeightResolution,
    dto: RegisterShippingWeightDto,
    user: AuthenticatedUser,
  ) {
    if (resolution.status === 'KEY_INSUFFICIENT') {
      throw new BadRequestException('Identidade logistica insuficiente para cadastrar peso.');
    }
    if (resolution.status === 'KEY_AMBIGUOUS') {
      throw new BadRequestException('Identidade logistica ambigua para cadastrar peso.');
    }

    const normalizedWeightLbs = normalizeShippingWeightLbs(dto.shippingWeightLbs);
    if (resolution.status === 'WEIGHT_FOUND') {
      if (normalizeShippingWeightLbs(resolution.shippingWeightLbs) === normalizedWeightLbs) {
        return { ...resolution, registration: 'IDEMPOTENT' as const };
      }
      throw new ConflictException(
        'Ja existe um peso operacional de envio diferente para esta identidade logistica.',
      );
    }

    const registered = await this.shippingWeightService.registerMissingWeight({
      shippingWeightKey: resolution.shippingWeightKey,
      shippingWeightLbs: dto.shippingWeightLbs,
      userId: user.id,
      context: {
        origin: dto.sourceProduct.origin,
        sourceProductId: dto.sourceProduct.sourceProductId,
        sourceQuoteId: dto.sourceProduct.sourceQuoteId ?? null,
        sourceName: dto.sourceProduct.sourceName,
      },
    });
    return {
      status: 'WEIGHT_FOUND' as const,
      registration: registered.outcome,
      ...registered.record,
    };
  }

  private async buildKeyInput(dto: RegisterShippingWeightDto): Promise<ShippingWeightKeyInput> {
    const source = dto.sourceProduct;
    const productIdentity = deriveExtendedProductIdentity({
      productName: source.sourceName,
      category: source.category,
      model: source.model,
      capacity: source.capacity,
      color: source.color,
      quality: source.condition,
    });
    const manufacturer = await this.resolveManufacturer(
      source,
      productIdentity.canonical.canonicalModelMatched,
    );

    return {
      manufacturer,
      productIdentity,
      composition: dto.composition,
      sourceContext: {
        sourceCommercialIdentity: {
          sourceProductId: source.sourceProductId,
          sourceName: source.sourceName,
          displayName: formatSourceDisplayName({
            sourceName: source.sourceName,
            sourceManufacturer: source.sourceManufacturer,
            model: source.model,
            capacity: source.capacity,
          }),
          source: source.origin,
          sourceUrl: source.sourceUrl,
          supplier: source.supplier,
          sourceManufacturer: source.sourceManufacturer ?? null,
          sourceManufacturerProvenance: source.sourceManufacturerProvenance ?? null,
        },
        sourceQuoteId: source.sourceQuoteId,
        store: source.supplier,
      },
    };
  }

  private async resolveManufacturer(
    source: RegisterShippingWeightDto['sourceProduct'],
    canonicalAppleModelMatched: boolean,
  ): Promise<ShippingWeightManufacturerResolution> {
    if (canonicalAppleModelMatched) return { status: 'RESOLVED', manufacturerKey: 'apple' };
    if (
      source.sourceManufacturerProvenance !== 'EXPLICIT_SOURCE' ||
      !source.sourceManufacturer?.trim() ||
      isReservedAppleManufacturerAlias(source.sourceManufacturer)
    ) {
      return { status: 'INSUFFICIENT' };
    }

    return toShippingWeightManufacturerResolution(
      await this.manufacturersService.resolve({
        evidence: source.sourceManufacturer,
        matchMode: 'EXACT_ALIAS',
        provenance: 'EXPLICIT_SOURCE_VALIDATED',
      }),
    );
  }
}

function toShippingWeightManufacturerResolution(
  resolution: ManufacturerResolution,
): ShippingWeightManufacturerResolution {
  if (resolution.status === 'FOUND') {
    return { status: 'RESOLVED', manufacturerKey: resolution.manufacturerKey };
  }
  return resolution.status === 'AMBIGUOUS' ? { status: 'AMBIGUOUS' } : { status: 'INSUFFICIENT' };
}
