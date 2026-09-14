import { createHash } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';

const PRODUCT_MODEL_NORMALIZED_NAME_MAX_LENGTH = 160;
const PRODUCT_MODEL_SCOPE_PREFIX = 'category';

export interface ProductModelNormalizationInput {
  categoryId: string;
  modelName: string;
}

export function normalizeProductModelNameComponent(modelName: string) {
  return modelName
    .trim()
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildProductModelNormalizedName({
  categoryId,
  modelName,
}: ProductModelNormalizationInput) {
  const normalizedCategoryId = categoryId.trim().toLowerCase();
  const normalizedModelName = normalizeProductModelNameComponent(modelName);
  if (!normalizedModelName) {
    throw new BadRequestException('Nome do modelo nao possui caracteres cadastraveis.');
  }

  const scope = `${PRODUCT_MODEL_SCOPE_PREFIX}:${normalizedCategoryId}`;
  const fullKey = `${scope}:${normalizedModelName}`;
  if (fullKey.length <= PRODUCT_MODEL_NORMALIZED_NAME_MAX_LENGTH) return fullKey;

  const digest = createHash('sha256').update(fullKey).digest('hex');
  const readableLength =
    PRODUCT_MODEL_NORMALIZED_NAME_MAX_LENGTH - scope.length - digest.length - 2;
  const readablePrefix = normalizedModelName.slice(0, Math.max(0, readableLength));

  return `${scope}:${readablePrefix}:${digest}`;
}
