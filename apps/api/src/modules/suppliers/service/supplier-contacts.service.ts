import { Inject, Injectable } from '@nestjs/common';
import { SupplierContactsRepository } from '../repository/supplier-contacts.repository';
import { normalizeWhatsappNumber } from '../validators/supplier-contacts.validators';

interface SupplierContactLookup {
  findActiveByWhatsappNumber(whatsappNumber: string): ReturnType<
    SupplierContactsRepository['findActiveByWhatsappNumber']
  >;
}

@Injectable()
export class SupplierContactsService {
  constructor(
    @Inject(SupplierContactsRepository)
    private readonly supplierContactsRepository: SupplierContactLookup,
  ) {}

  findActiveByWhatsappNumber(remoteJidOrPhone: string) {
    return this.supplierContactsRepository.findActiveByWhatsappNumber(
      normalizeWhatsappNumber(remoteJidOrPhone),
    );
  }
}
