import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateSupplierContactDto,
  SupplierContactQueryDto,
  UpdateSupplierContactDto,
} from '../dto/supplier-contact.dto';
import { SupplierContactRecord } from '../interfaces/supplier-contacts-prisma.interface';
import { SupplierContactsRepository } from '../repository/supplier-contacts.repository';
import { normalizeWhatsappNumber } from '../validators/supplier-contacts.validators';

interface SupplierContactLookup {
  findActiveByWhatsappNumber(whatsappNumber: string): ReturnType<
    SupplierContactsRepository['findActiveByWhatsappNumber']
  >;
  list(search?: string, isActive?: boolean): Promise<SupplierContactRecord[]>;
  findById(id: string): Promise<SupplierContactRecord | null>;
  findByWhatsappNumber(whatsappNumber: string): Promise<SupplierContactRecord | null>;
  create(data: {
    supplierName: string;
    whatsappNumber: string;
    address: string | null;
  }): Promise<SupplierContactRecord>;
  update(
    id: string,
    data: { supplierName: string; whatsappNumber: string; address: string | null },
  ): Promise<SupplierContactRecord>;
  setActive(id: string, isActive: boolean): Promise<SupplierContactRecord>;
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

  list(query: SupplierContactQueryDto) {
    return this.supplierContactsRepository.list(query.search?.trim() || undefined, query.isActive);
  }

  async create(dto: CreateSupplierContactDto) {
    const whatsappNumber = normalizeWhatsappNumber(dto.whatsappNumber);
    await this.ensureWhatsappNumberIsAvailable(whatsappNumber);
    return this.supplierContactsRepository.create(this.toData(dto, whatsappNumber));
  }

  async update(id: string, dto: UpdateSupplierContactDto) {
    await this.ensureContactExists(id);
    const whatsappNumber = normalizeWhatsappNumber(dto.whatsappNumber);
    await this.ensureWhatsappNumberIsAvailable(whatsappNumber, id);
    return this.supplierContactsRepository.update(id, this.toData(dto, whatsappNumber));
  }

  async setActive(id: string, isActive: boolean) {
    await this.ensureContactExists(id);
    return this.supplierContactsRepository.setActive(id, isActive);
  }

  private toData(dto: CreateSupplierContactDto, whatsappNumber: string) {
    return {
      supplierName: dto.supplierName.trim(),
      whatsappNumber,
      address: dto.address?.trim() || null,
    };
  }

  private async ensureContactExists(id: string) {
    const contact = await this.supplierContactsRepository.findById(id);
    if (!contact) {
      throw new NotFoundException('Contato de fornecedor nao encontrado.');
    }
    return contact;
  }

  private async ensureWhatsappNumberIsAvailable(whatsappNumber: string, currentId?: string) {
    const existing = await this.supplierContactsRepository.findByWhatsappNumber(whatsappNumber);
    if (existing && existing.id !== currentId) {
      throw new ConflictException('Este numero de WhatsApp ja esta cadastrado para outro fornecedor.');
    }
  }
}
