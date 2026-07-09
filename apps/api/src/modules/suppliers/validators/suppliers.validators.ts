import { BadRequestException } from '@nestjs/common';

export function ensureSupplierExists(record: unknown) {
  if (!record) {
    throw new BadRequestException('Fornecedor nao encontrado.');
  }
}

export function buildWhatsappLink(phone?: string | null) {
  if (!phone) {
    return null;
  }

  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}
