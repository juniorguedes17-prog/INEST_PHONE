export const PUBLIC_CONTRACT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type CreatedPublicContractLink = {
  contractId: string;
  publicToken: string;
};

export function isPublicContractToken(value: unknown): value is string {
  return typeof value === 'string' && PUBLIC_CONTRACT_TOKEN_PATTERN.test(value);
}

export function isResolvedPublicContractLink(data: unknown, error: unknown) {
  return !error && data === true;
}

export function toCreatedPublicContractLink(value: unknown): CreatedPublicContractLink | null {
  if (!value || typeof value !== 'object') return null;

  const candidate = value as { contract_id?: unknown; public_token?: unknown };
  if (typeof candidate.contract_id !== 'string' || !isPublicContractToken(candidate.public_token)) {
    return null;
  }

  return { contractId: candidate.contract_id, publicToken: candidate.public_token };
}

export function publicContractLinkUrl(origin: string, token: string): string {
  return new URL(`/c/${token}`, origin).toString();
}
