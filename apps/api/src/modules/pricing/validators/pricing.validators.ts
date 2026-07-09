const rejectionTerms = [
  'grade b',
  'grade c',
  'grade d',
  'defeito',
  'tela nao genuina',
  'bateria nao genuina',
  'pecas substituidas',
  'alerta interno',
  'mensagem de hardware',
  'mensagem de tela',
  'mensagem de bateria',
  'face id com problema',
  'true tone ausente',
  '[radar_hidden]',
];

export function quoteIsValid(input: {
  notes?: string | null;
  quality?: string | null;
  productStatus?: string | null;
  supplierStatus?: string | null;
}) {
  const content = normalize(`${input.notes ?? ''} ${input.quality ?? ''}`);
  const hasRejection = rejectionTerms.some((term) => content.includes(term));

  return (
    !hasRejection &&
    input.productStatus !== 'INACTIVE' &&
    input.productStatus !== 'REJECTED' &&
    input.supplierStatus !== 'INACTIVE'
  );
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
