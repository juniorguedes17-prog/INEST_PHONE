import { describe, expect, it, vi } from 'vitest';
import { SupplierContactsService } from './supplier-contacts.service';

describe('SupplierContactsService', () => {
  it('finds an active supplier by the normalized WhatsApp number', async () => {
    const findActiveByWhatsappNumber = vi.fn().mockResolvedValue({
      supplierName: 'Elite Shop',
      whatsappNumber: '5511943020886',
      isActive: true,
    });
    const service = new SupplierContactsService({
      findActiveByWhatsappNumber,
      list: vi.fn(),
      findById: vi.fn(),
      findByWhatsappNumber: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      setActive: vi.fn(),
    });

    await expect(service.findActiveByWhatsappNumber('+55 (11) 94302-0886')).resolves.toMatchObject({
      supplierName: 'Elite Shop',
      whatsappNumber: '5511943020886',
    });
    expect(findActiveByWhatsappNumber).toHaveBeenCalledWith('5511943020886');
  });

  it('rejects a duplicate normalized number before creating a contact', async () => {
    const create = vi.fn();
    const service = new SupplierContactsService({
      findActiveByWhatsappNumber: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findByWhatsappNumber: vi.fn().mockResolvedValue({ id: 'existing-contact' }),
      create,
      update: vi.fn(),
      setActive: vi.fn(),
    });

    await expect(
      service.create({
        supplierName: 'Elite Shop',
        whatsappNumber: '+55 (11) 94302-0886',
      }),
    ).rejects.toThrow('Este numero de WhatsApp ja esta cadastrado para outro fornecedor.');
    expect(create).not.toHaveBeenCalled();
  });

  it('normalizes the number before persisting a new contact', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'new-contact' });
    const service = new SupplierContactsService({
      findActiveByWhatsappNumber: vi.fn(),
      list: vi.fn(),
      findById: vi.fn(),
      findByWhatsappNumber: vi.fn().mockResolvedValue(null),
      create,
      update: vi.fn(),
      setActive: vi.fn(),
    });

    await service.create({
      supplierName: 'Elite Shop',
      whatsappNumber: '+55 (11) 94302-0886',
      address: 'Shopping Mundo Oriental',
    });

    expect(create).toHaveBeenCalledWith({
      supplierName: 'Elite Shop',
      whatsappNumber: '5511943020886',
      address: 'Shopping Mundo Oriental',
    });
  });
});
