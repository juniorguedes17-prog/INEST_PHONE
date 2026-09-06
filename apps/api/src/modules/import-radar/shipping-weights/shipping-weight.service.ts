import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import type {
  RegisteredShippingWeight,
  RegisterMissingShippingWeightInput,
  ShippingWeightKeyInput,
  ShippingWeightRecord,
  ShippingWeightResolution,
  UpsertShippingWeightInput,
} from './shipping-weight.contract';
import {
  deriveShippingWeightKey,
  SHIPPING_WEIGHT_KEY_VERSION,
} from './shipping-weight-key-deriver';
import {
  ShippingWeightRepository,
  type ShippingWeightPersistenceRecord,
} from './shipping-weight.repository';

export const SHIPPING_WEIGHT_LBS_MAX = 99_999.999;

@Injectable()
export class ShippingWeightService {
  constructor(
    @Inject(ShippingWeightRepository) private readonly repository: ShippingWeightRepository,
  ) {}

  async resolveWeight(input: ShippingWeightKeyInput): Promise<ShippingWeightResolution> {
    const keyResolution = deriveShippingWeightKey(input);
    if (keyResolution.status !== 'KEY_RESOLVED') return keyResolution;

    const record = await this.repository.findByShippingWeightKey(keyResolution.shippingWeightKey);
    return record
      ? { status: 'WEIGHT_FOUND', ...toShippingWeightRecord(record) }
      : { status: 'MISSING_WEIGHT', shippingWeightKey: keyResolution.shippingWeightKey };
  }

  async upsertWeight(input: UpsertShippingWeightInput): Promise<ShippingWeightRecord> {
    assertShippingWeightKey(input.shippingWeightKey);
    const shippingWeightLbs = normalizeShippingWeightLbs(input.shippingWeightLbs);
    const oldRecord = await this.repository.findByShippingWeightKey(input.shippingWeightKey);
    const record = await this.repository.upsertWeight({
      shippingWeightKey: input.shippingWeightKey,
      shippingWeightLbs,
      userId: input.userId,
    });
    const effectiveRecord = toShippingWeightRecord(record);

    await this.repository.createAuditLog({
      userId: input.userId,
      operationType: oldRecord ? 'UPDATE' : 'CREATE',
      entityId: record.id,
      oldValue: oldRecord
        ? { shippingWeightLbs: oldRecord.shippingWeightLbs.toString() }
        : undefined,
      newValue: { shippingWeightLbs: shippingWeightLbs },
      context: {
        event: oldRecord ? 'shipping_weight.updated' : 'shipping_weight.created',
        shippingWeightKey: input.shippingWeightKey,
        ...input.context,
      },
    });

    return effectiveRecord;
  }

  /**
   * Registers only a currently missing key. A unique-key race is resolved by
   * comparing the persisted value, never by overwriting the other writer.
   */
  async registerMissingWeight(
    input: RegisterMissingShippingWeightInput,
  ): Promise<RegisteredShippingWeight> {
    assertShippingWeightKey(input.shippingWeightKey);
    const shippingWeightLbs = normalizeShippingWeightLbs(input.shippingWeightLbs);

    try {
      const record = await this.repository.createWeight({
        shippingWeightKey: input.shippingWeightKey,
        shippingWeightLbs,
        userId: input.userId,
      });
      const effectiveRecord = toShippingWeightRecord(record);
      await this.createRegistrationAudit({
        input,
        record,
        shippingWeightLbs,
        event: 'shipping_weight.registered',
      });
      return { record: effectiveRecord, outcome: 'CREATED' };
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
    }

    const existing = await this.repository.findByShippingWeightKey(input.shippingWeightKey);
    if (!existing) {
      throw new ConflictException(
        'Conflito ao registrar peso operacional de envio. Tente novamente.',
      );
    }
    if (existing.shippingWeightLbs.toString() === shippingWeightLbs) {
      return { record: toShippingWeightRecord(existing), outcome: 'IDEMPOTENT' };
    }
    throw new ConflictException(
      'Ja existe um peso operacional de envio diferente para esta identidade logistica.',
    );
  }

  private createRegistrationAudit({
    input,
    record,
    shippingWeightLbs,
    event,
  }: {
    input: RegisterMissingShippingWeightInput;
    record: ShippingWeightPersistenceRecord;
    shippingWeightLbs: string;
    event: string;
  }) {
    return this.repository.createAuditLog({
      userId: input.userId,
      operationType: 'CREATE',
      entityId: record.id,
      newValue: { shippingWeightLbs },
      context: {
        event,
        shippingWeightKey: input.shippingWeightKey,
        ...input.context,
      },
    });
  }
}

export function normalizeShippingWeightLbs(value: unknown): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new BadRequestException(
      'O peso operacional de envio em lbs deve ser um numero finito maior que zero.',
    );
  }
  if (value > SHIPPING_WEIGHT_LBS_MAX) {
    throw new BadRequestException(
      `O peso operacional de envio em lbs excede o limite tecnico de ${SHIPPING_WEIGHT_LBS_MAX}.`,
    );
  }

  const normalized = value.toFixed(3);
  if (Number(normalized) !== value) {
    throw new BadRequestException(
      'O peso operacional de envio em lbs aceita no maximo tres casas decimais.',
    );
  }
  return normalized;
}

function assertShippingWeightKey(shippingWeightKey: string) {
  if (
    typeof shippingWeightKey !== 'string' ||
    !shippingWeightKey.startsWith(`${SHIPPING_WEIGHT_KEY_VERSION}|`)
  ) {
    throw new BadRequestException('shippingWeightKey invalida.');
  }
}

function toShippingWeightRecord(record: ShippingWeightPersistenceRecord): ShippingWeightRecord {
  return {
    ...record,
    shippingWeightLbs: Number(record.shippingWeightLbs.toString()),
  };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
