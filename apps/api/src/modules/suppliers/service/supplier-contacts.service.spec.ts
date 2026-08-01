import { describe, expect, it, vi } from 'vitest';
import { SupplierContactsService } from './supplier-contacts.service';

describe('SupplierContactsService', () => {
  it('finds an active supplier by the normalized WhatsApp number', async () => {
    const findActiveByWhatsappNumber = vi.fn().mockResolvedValue({
      supplierName: 'Elite Shop',
      whatsappNumber: '5511943020886',
      isActive: true,
    });
    const service = new SupplierContactsService({ findActiveByWhatsappNumber });

    await expect(service.findActiveByWhatsappNumber('+55 (11) 94302-0886')).resolves.toMatchObject({
      supplierName: 'Elite Shop',
      whatsappNumber: '5511943020886',
    });
    expect(findActiveByWhatsappNumber).toHaveBeenCalledWith('5511943020886');
  });
});
