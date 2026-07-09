const rejectionTerms = [
  'grade b',
  'grade c',
  'grade d',
  'defeito',
  'tela nao genuina',
  'bateria nao genuina',
  'pecas substituidas',
  'alerta interno',
  'alerta de hardware',
  'mensagem de hardware',
  'mensagem de tela',
  'mensagem de bateria',
  'face id com problema',
  'face id defeito',
  'true tone ausente',
];

export function validateQuoteQuality(input: { quality?: string | null; notes?: string | null }) {
  const content = normalize(`${input.quality ?? ''} ${input.notes ?? ''}`);
  const matchedTerms = rejectionTerms.filter((term) => content.includes(term));

  return {
    valid: matchedTerms.length === 0,
    status: matchedTerms.length ? 'hidden' : 'valid',
    inconsistencies: matchedTerms,
  };
}

export function markHidden(notes?: string | null) {
  const currentNotes = notes ?? '';
  return currentNotes.includes('[RADAR_HIDDEN]')
    ? currentNotes
    : `${currentNotes} [RADAR_HIDDEN]`.trim();
}

export function isHidden(notes?: string | null) {
  return Boolean(notes?.includes('[RADAR_HIDDEN]'));
}

export function buildWhatsappLink(phone?: string | null) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  return digits ? `https://wa.me/${digits}` : null;
}

export function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}
