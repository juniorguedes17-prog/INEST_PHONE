import { createSign } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GOOGLE_SHEETS_HEADERS,
  GoogleSheetsCustomer,
  GoogleSheetsHeader,
  GoogleSheetsMetrics,
  GoogleSheetsSaleRecord,
  GoogleSheetsSnapshot,
} from '../interfaces/google-sheets-data.interface';
import {
  IntegrationProvider,
  IntegrationResult,
} from '../interfaces/integration-provider.interface';

interface GoogleValuesResponse {
  values?: unknown[][];
}

@Injectable()
export class GoogleSheetsProvider implements IntegrationProvider {
  readonly key = 'google_sheets';
  readonly name = 'Google Sheets';
  readonly type = 'google_sheets' as const;
  private readonly logger = new Logger(GoogleSheetsProvider.name);
  private snapshot: GoogleSheetsSnapshot | null = null;

  constructor(private readonly configService: ConfigService) {}

  get version() {
    return this.snapshot?.metrics.lastSync ?? 'not-synced';
  }

  async status(): Promise<IntegrationResult> {
    const configured = this.hasCredentials();
    return {
      success: configured,
      message: configured
        ? 'Google Sheets configurado como fonte oficial de Clientes e Dashboard.'
        : 'Credenciais do Google Sheets ainda nao configuradas.',
      data: {
        mode: configured ? 'live' : 'not_configured',
        lastSync: this.snapshot?.metrics.lastSync ?? null,
        rows: this.snapshot?.records.length ?? 0,
      },
    };
  }

  async testConnection(): Promise<IntegrationResult> {
    const records = await this.fetchRecords();
    return {
      success: true,
      message: `Conexao realizada com sucesso. ${records.length} linhas validas encontradas.`,
      data: { rows: records.length },
    };
  }

  async sync(): Promise<IntegrationResult> {
    const records = await this.fetchRecords();
    this.snapshot = buildGoogleSheetsSnapshot(records, new Date().toISOString());
    this.logger.log({
      event: 'google_sheets.synced',
      rows: records.length,
      customers: this.snapshot.customers.length,
    });

    return {
      success: true,
      message: 'Google Sheets sincronizado com sucesso.',
      data: {
        rows: records.length,
        customers: this.snapshot.customers.length,
        metrics: this.snapshot.metrics,
      },
    };
  }

  async getSnapshot(): Promise<GoogleSheetsSnapshot> {
    if (!this.snapshot) {
      await this.sync();
    }
    return this.snapshot as GoogleSheetsSnapshot;
  }

  private async fetchRecords() {
    const spreadsheetId =
      this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID') ??
      this.configService.get<string>('GOOGLE_SHEETS_ID');
    const range = this.configService.get<string>('GOOGLE_SHEETS_RANGE') || 'A:AZ';
    if (!spreadsheetId || !this.hasCredentials()) {
      throw new Error('Credenciais obrigatorias do Google Sheets nao configuradas.');
    }

    const token = await this.createAccessToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Google Sheets respondeu com status ${response.status}.`);
    }
    const payload = (await response.json()) as GoogleValuesResponse;
    return mapSheetValues(payload.values ?? []);
  }

  private async createAccessToken() {
    const clientEmail = this.configService.get<string>('GOOGLE_SHEETS_CLIENT_EMAIL') as string;
    const privateKey = (this.configService.get<string>('GOOGLE_SHEETS_PRIVATE_KEY') as string).replace(
      /\\n/g,
      '\n',
    );
    const now = Math.floor(Date.now() / 1000);
    const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = base64Url(
      JSON.stringify({
        iss: clientEmail,
        scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      }),
    );
    const unsignedToken = `${header}.${claim}`;
    const signature = createSign('RSA-SHA256').update(unsignedToken).sign(privateKey, 'base64url');
    const assertion = `${unsignedToken}.${signature}`;
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json()) as { access_token?: string };
    if (!response.ok || !payload.access_token) {
      throw new Error('Nao foi possivel autenticar a conta de servico do Google Sheets.');
    }
    return payload.access_token;
  }

  private hasCredentials() {
    return Boolean(
      (this.configService.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID') ||
        this.configService.get<string>('GOOGLE_SHEETS_ID')) &&
        this.configService.get<string>('GOOGLE_SHEETS_CLIENT_EMAIL') &&
        this.configService.get<string>('GOOGLE_SHEETS_PRIVATE_KEY'),
    );
  }
}

export function mapSheetValues(values: unknown[][]): GoogleSheetsSaleRecord[] {
  if (!values.length) return [];
  const headers = values[0]!.map((value) => normalizeHeader(String(value ?? '')));
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const missing = GOOGLE_SHEETS_HEADERS.filter((header) => !indexByHeader.has(header));
  if (missing.length) {
    throw new Error(`Cabecalhos obrigatorios ausentes no Google Sheets: ${missing.join(', ')}`);
  }

  return values.slice(1).filter(hasContent).map((row) => {
    const record = {} as GoogleSheetsSaleRecord;
    GOOGLE_SHEETS_HEADERS.forEach((header) => {
      record[header] = String(row[indexByHeader.get(header) as number] ?? '').trim();
    });
    return record;
  });
}

export function buildGoogleSheetsSnapshot(
  records: GoogleSheetsSaleRecord[],
  lastSync: string,
): GoogleSheetsSnapshot {
  const customerMap = new Map<string, GoogleSheetsCustomer>();
  records.forEach((record, index) => {
    if (!record.cliente_nome && !record.cliente_cpf && !record.cliente_email) return;
    const id = customerKey(record, index);
    const existing = customerMap.get(id);
    const sold = parseNumber(record.quantidade_vendida);
    const saleDate = parseDate(record.data_venda);
    const revenue = parseNumber(record.receita_venda_real);
    if (!existing) {
      customerMap.set(id, {
        id,
        name: record.cliente_nome,
        cpf: record.cliente_cpf,
        address: record.cliente_endereco,
        complement: record.cliente_complemento,
        city: record.cliente_cidade,
        state: record.cliente_uf,
        phone: record.cliente_telefone,
        email: record.cliente_email,
        origin: record.cliente_origem,
        salesCount: saleDate ? 1 : 0,
        productsSold: sold,
        totalRevenue: revenue,
        lastSale: saleDate,
      });
      return;
    }
    existing.salesCount += saleDate ? 1 : 0;
    existing.productsSold += sold;
    existing.totalRevenue += revenue;
    if (saleDate && (!existing.lastSale || saleDate > existing.lastSale)) existing.lastSale = saleDate;
  });

  const soldRecords = records.filter((record) => Boolean(parseDate(record.data_venda)));
  const totalRevenue = sum(records, 'receita_venda_real');
  const totalSales = soldRecords.length;
  const metrics: GoogleSheetsMetrics = {
    totalCustomers: customerMap.size,
    totalSales,
    totalRevenue,
    totalProfit: sum(records, 'lucro_real'),
    averageTicket: totalSales ? totalRevenue / totalSales : 0,
    productsSold: sum(records, 'quantidade_vendida'),
    lastSale: latestDate(records.map((record) => parseDate(record.data_venda))),
    lastSync,
  };
  return { records, customers: Array.from(customerMap.values()), metrics };
}

function sum(records: GoogleSheetsSaleRecord[], field: GoogleSheetsHeader) {
  return records.reduce((total, record) => total + parseNumber(record[field]), 0);
}

function parseNumber(value: string) {
  const clean = value.replace(/[^0-9,.-]/g, '');
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDate(value: string): string | null {
  if (!value) return null;
  const br = value.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const date = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T00:00:00`) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function latestDate(values: Array<string | null>) {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function customerKey(record: GoogleSheetsSaleRecord, index: number) {
  return (
    record.cliente_cpf ||
    record.cliente_email.toLowerCase() ||
    record.cliente_telefone ||
    `${record.cliente_nome.toLowerCase()}-${index}`
  );
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function hasContent(row: unknown[]) {
  return row.some((value) => String(value ?? '').trim());
}

function base64Url(value: string) {
  return Buffer.from(value).toString('base64url');
}
