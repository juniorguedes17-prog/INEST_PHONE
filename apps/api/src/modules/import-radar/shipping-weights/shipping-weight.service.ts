import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
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
