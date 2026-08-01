const E164_DIGITS_MIN_LENGTH = 8;
const E164_DIGITS_MAX_LENGTH = 15;

export function normalizeWhatsappNumber(value: string): string {
  const normalized = value.replace(/\D/g, '');

  if (
    normalized.length < E164_DIGITS_MIN_LENGTH ||
    normalized.length > E164_DIGITS_MAX_LENGTH
  ) {
    throw new Error('Numero de WhatsApp invalido para o padrao E.164.');
  }

  return normalized;
}
