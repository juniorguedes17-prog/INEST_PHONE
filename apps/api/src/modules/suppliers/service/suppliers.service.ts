import { Inject, Injectable } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { SupplierRecord } from '../interfaces/suppliers-prisma.interface';
import { SuppliersRepository } from '../repository/suppliers.repository';
import { buildWhatsappLink, ensureSupplierExists } from '../validators/suppliers.validators';

@Injectable()
export class SuppliersService {
  constructor(@Inject(SuppliersRepository) private readonly suppliersRepository: SuppliersRepository) {}

  async list(query: SupplierQueryDto) {
    const suppliers = await this.suppliersRepository.list(query);
    return suppliers.map((supplier) => this.toResponse(supplier));
  }

  async findOne(id: string) {
    const supplier = await this.suppliersRepository.findOne(id);
    ensureSupplierExists(supplier);
    return this.toResponse(supplier as SupplierRecord);
  }

  async create(dto: CreateSupplierDto, user?: AuthenticatedUser) {
    const supplier = await this.suppliersRepository.create(dto, user?.id);
    await this.suppliersRepository.createAuditLog({
      userId: user?.id,
      operationType: 'CREATE',
      entityId: supplier.id,
      newValue: supplier,
      context: { event: 'suppliers.created' },
    });
    return this.toResponse(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto, user?: AuthenticatedUser) {
    const oldValue = await this.suppliersRepository.findOne(id);
    ensureSupplierExists(oldValue);
    const supplier = await this.suppliersRepository.update(id, dto, user?.id);
    await this.suppliersRepository.createAuditLog({
      userId: user?.id,
      operationType: 'UPDATE',
      entityId: supplier.id,
      oldValue,
      newValue: supplier,
      context: { event: 'suppliers.updated' },
    });
    return this.toResponse(supplier);
  }

  async softDelete(id: string, user?: AuthenticatedUser) {
    const oldValue = await this.suppliersRepository.findOne(id);
    ensureSupplierExists(oldValue);
    const supplier = await this.suppliersRepository.softDelete(id, user?.id);
    await this.suppliersRepository.createAuditLog({
      userId: user?.id,
      operationType: 'DELETE',
      entityId: supplier.id,
      oldValue,
      newValue: supplier,
      context: { event: 'suppliers.soft_deleted' },
    });
    return this.toResponse(supplier);
  }

  async activate(id: string, user?: AuthenticatedUser) {
    return this.changeStatus(id, 'ACTIVE', user, 'suppliers.activated');
  }

  async deactivate(id: string, user?: AuthenticatedUser) {
    return this.changeStatus(id, 'INACTIVE', user, 'suppliers.deactivated');
  }

  private async changeStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE',
    user: AuthenticatedUser | undefined,
    event: string,
  ) {
    const oldValue = await this.suppliersRepository.findOne(id);
    ensureSupplierExists(oldValue);
    const supplier = await this.suppliersRepository.setStatus(id, status, user?.id);
    await this.suppliersRepository.createAuditLog({
      userId: user?.id,
      operationType: 'UPDATE',
      entityId: supplier.id,
      oldValue,
      newValue: supplier,
      context: { event },
    });
    return this.toResponse(supplier);
  }

  private toResponse(supplier: SupplierRecord) {
    return {
      ...supplier,
      whatsappLink: buildWhatsappLink(supplier.phone),
      integrationReadiness: {
        priceRadar: true,
        importRadar: true,
        whatsappBusiness: Boolean(supplier.phone),
        comprasParaguai: supplier.source?.toLowerCase().includes('paraguai') ?? false,
      },
    };
  }
}
