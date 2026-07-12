import { Inject, Injectable } from '@nestjs/common';
import { GoogleSheetsProvider } from '../../integrations/providers/google-sheets.provider';
import { CustomersQueryDto } from '../dto/customers-query.dto';

@Injectable()
export class CustomersService {
  constructor(
    @Inject(GoogleSheetsProvider)
    private readonly googleSheetsProvider: GoogleSheetsProvider,
  ) {}

  async list(query: CustomersQueryDto) {
    const snapshot = await this.googleSheetsProvider.getSnapshot();
    const search = query.search?.trim().toLocaleLowerCase('pt-BR') ?? '';
    const origin = query.origin?.trim().toLocaleUpperCase('pt-BR') ?? '';
    const filtered = snapshot.customers.filter((customer) => {
      const searchable = [
        customer.name,
        customer.cpf,
        customer.email,
        customer.phone,
        customer.city,
        customer.state,
      ]
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return (!search || searchable.includes(search)) &&
        (!origin || customer.origin.toLocaleUpperCase('pt-BR') === origin);
    });
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const start = (currentPage - 1) * pageSize;

    return {
      items: filtered.slice(start, start + pageSize),
      summary: snapshot.metrics,
      pagination: {
        page: currentPage,
        pageSize,
        totalItems: filtered.length,
        totalPages,
      },
    };
  }

  async sync() {
    await this.googleSheetsProvider.sync();
    return this.list(new CustomersQueryDto());
  }
}
