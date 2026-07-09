import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreatePriceQuoteDto,
  CsvImportDto,
  PriceRadarQueryDto,
  UpdatePriceQuoteDto,
  ValidateQuoteDto,
} from '../dto/price-radar.dto';
import { PriceQuoteRecord } from '../interfaces/price-radar-prisma.interface';
import { PriceRadarRepository } from '../repository/price-radar.repository';
import {
  buildWhatsappLink,
  isHidden,
  toNumber,
  validateQuoteQuality,
} from '../validators/price-radar.validators';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';

@Injectable()
export class PriceRadarService {
  constructor(@Inject(PriceRadarRepository) private readonly repository: PriceRadarRepository) {}

  async list(query: PriceRadarQueryDto) {
    const records = await this.repository.listQuotes(query);
    return this.applyPostFilters(
      records.map((record) => this.toResponse(record)),
      query,
    );
  }

  async findOne(id: string) {
    const quote = await this.repository.findQuote(id);
    if (!quote) {
      throw new NotFoundException('Cotacao nao encontrada.');
    }
    return this.toResponse(quote);
  }

  async kpis(query: PriceRadarQueryDto) {
    const quotes = await this.list({ ...query, status: undefined });
    const validQuotes = quotes.filter((quote) => quote.valid && quote.status !== 'hidden');
    const prices = validQuotes.map((quote) => quote.costProduct);
    const hiddenCount = quotes.filter((quote) => quote.status === 'hidden').length;

    return {
      lowestValidPrice: prices.length ? Math.min(...prices) : 0,
      averagePrice: prices.length
        ? prices.reduce((total, price) => total + price, 0) / prices.length
        : 0,
      highestPrice: prices.length ? Math.max(...prices) : 0,
      hiddenCount,
    };
  }

  async create(dto: CreatePriceQuoteDto, user: AuthenticatedUser) {
    await this.validateReferences(dto.productId, dto.supplierId);
    const quote = await this.repository.createQuote(dto);
    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'CREATE',
      entityId: quote.id,
      newValue: quote,
    });
    return this.toResponse(quote);
  }

  async update(id: string, dto: UpdatePriceQuoteDto, user: AuthenticatedUser) {
    const current = await this.repository.findQuote(id);
    if (!current) {
      throw new NotFoundException('Cotacao nao encontrada.');
    }
    await this.validateReferences(dto.productId, dto.supplierId);
    const quote = await this.repository.updateQuote(id, dto);
    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'UPDATE',
      entityId: id,
      oldValue: current,
      newValue: quote,
    });
    return this.toResponse(quote);
  }

  async hide(id: string, user: AuthenticatedUser) {
    const current = await this.repository.findQuote(id);
    if (!current) {
      throw new NotFoundException('Cotacao nao encontrada.');
    }
    const quote = await this.repository.hideQuote(id);
    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'DELETE',
      entityId: id,
      oldValue: current,
      newValue: quote,
      context: { action: 'logical_hide' },
    });
    return this.toResponse(quote);
  }

  validate(dto: ValidateQuoteDto) {
    return validateQuoteQuality(dto);
  }

  async importCsv(dto: CsvImportDto, user: AuthenticatedUser) {
    const rows = this.parseCsv(dto.csvContent);
    const inconsistencies: Array<{ row: number; message: string }> = [];
    let validRecords = 0;

    for (const [index, row] of rows.entries()) {
      try {
        if (!row.productId || !row.supplierId || !row.costProduct) {
          throw new BadRequestException('Produto, fornecedor e custo sao obrigatorios.');
        }
        const payload: CreatePriceQuoteDto = {
          productId: row.productId,
          supplierId: row.supplierId,
          costProduct: Number(row.costProduct),
          deliveryTime: row.deliveryTime,
          city: row.city,
          quality: row.quality,
          notes: row.notes,
          quoteDate: row.quoteDate,
        };
        await this.validateReferences(payload.productId, payload.supplierId);
        await this.repository.createQuote(payload);
        validRecords += 1;
      } catch (error) {
        inconsistencies.push({
          row: index + 2,
          message: error instanceof Error ? error.message : 'Linha invalida.',
        });
      }
    }

    const batch = await this.repository.createImportBatch({
      userId: user.id,
      totalRecords: rows.length,
      validRecords,
      invalidRecords: inconsistencies.length,
      messages: inconsistencies,
    });

    await this.repository.createAuditLog({
      userId: user.id,
      operationType: 'IMPORT',
      entityId: batch.id,
      context: {
        source: 'CSV',
        totalRecords: rows.length,
        validRecords,
        invalidRecords: inconsistencies.length,
      },
    });

    return {
      importBatchId: batch.id,
      totalRecords: rows.length,
      validRecords,
      invalidRecords: inconsistencies.length,
      inconsistencies,
    };
  }

  importExcel() {
    return {
      status: 'prepared',
      message:
        'Endpoint preparado para Excel. O parser binario sera conectado quando a dependencia for autorizada.',
    };
  }

  private async validateReferences(productId: string, supplierId: string) {
    const [product, supplier] = await Promise.all([
      this.repository.findProduct(productId),
      this.repository.findSupplier(supplierId),
    ]);

    if (!product) {
      throw new BadRequestException('Produto informado nao existe no catalogo mestre.');
    }
    if (!supplier) {
      throw new BadRequestException('Fornecedor informado nao existe no cadastro oficial.');
    }
  }

  private parseCsv(csvContent: string) {
    const lines = csvContent
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new BadRequestException('CSV deve possuir cabecalho e ao menos uma linha.');
    }

    const headerLine = lines[0];
    if (!headerLine) {
      throw new BadRequestException('CSV deve possuir cabecalho.');
    }
    const headers = headerLine.split(',').map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(',').map((value) => value.trim());
      return headers.reduce<Record<string, string>>((row, header, index) => {
        row[header] = values[index] ?? '';
        return row;
      }, {});
    });
  }

  private applyPostFilters(
    quotes: ReturnType<PriceRadarService['toResponse']>[],
    query: PriceRadarQueryDto,
  ) {
    const filtered = quotes.filter((quote) => {
      if (query.status && quote.status !== query.status) {
        return false;
      }
      if (query.quality && !quote.quality.toLowerCase().includes(query.quality.toLowerCase())) {
        return false;
      }
      return true;
    });

    if (query.sort === 'supplier') {
      return filtered.sort((a, b) => a.supplier.name.localeCompare(b.supplier.name));
    }
    if (query.sort === 'product') {
      return filtered.sort((a, b) => a.productName.localeCompare(b.productName));
    }
    if (query.sort === 'delivery') {
      return filtered.sort((a, b) => a.deliveryTime.localeCompare(b.deliveryTime));
    }
    return filtered;
  }

  private toResponse(record: PriceQuoteRecord) {
    const validation = validateQuoteQuality({
      quality: record.product?.qualityGrade,
      notes: record.notes,
    });
    const hidden = isHidden(record.notes) || !validation.valid;
    const productName = [
      record.product?.category?.name,
      record.product?.model?.name,
      record.product?.storage?.displayName,
      record.product?.color?.name,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: record.id,
      productId: record.productId,
      supplierId: record.supplierId,
      productName: productName || 'Produto nao identificado',
      category: record.product?.category?.name ?? '',
      model: record.product?.model?.name ?? '',
      color: record.product?.color?.name ?? '',
      capacity: record.product?.storage?.displayName ?? '',
      productType: record.product?.productType ?? '',
      quality: record.product?.qualityGrade ?? '',
      supplier: {
        id: record.supplier?.id ?? record.supplierId,
        name: record.supplier?.name ?? 'Fornecedor nao informado',
        contact: record.supplier?.contact ?? '',
        phone: record.supplier?.phone ?? '',
        source: record.supplier?.source ?? '',
        whatsappLink: buildWhatsappLink(record.supplier?.phone),
      },
      city: record.city ?? '',
      deliveryTime: record.deliveryTime ?? '',
      contact: record.contact ?? '',
      notes: record.notes ?? '',
      costProduct: toNumber(record.costProduct),
      quoteDate: record.quoteDate,
      updatedAt: record.createdAt ?? record.quoteDate,
      status: hidden ? 'hidden' : 'valid',
      valid: validation.valid && !hidden,
      inconsistencies: validation.inconsistencies,
    };
  }
}
