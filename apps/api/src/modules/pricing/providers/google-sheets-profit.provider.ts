import { createSign } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PROFIT_SHEET_HEADERS,
  ProfitCondition,
  ProfitLookupResult,
  ProfitSheetCatalog,
  ProfitSheetRecord,
} from '../interfaces/profit-sheet.interface';

interface GoogleValuesResponse {
  values?: unknown[][];
}

const CACHE_TTL_MS = 60_000;

@Injectable()
export class GoogleSheetsProfitProvider {
  private readonly logger = new Logger(GoogleSheetsProfitProvider.name);
  private cache: { catalog: ProfitSheetCatalog; expiresAt: number } | null = null;

  constructor(private readonly configService: ConfigService) {}

  async getCatalog(forceRefresh = false): Promise<ProfitSheetCatalog> {
    if (!forceRefresh && this.cache && this.cache.expiresAt > Date.now()) {
      return this.cache.catalog;
    }

    const records = await this.fetchRecords();
    const catalog = { records, fetchedAt: new Date().toISOString() };
    this.cache = { catalog, expiresAt: Date.now() + CACHE_TTL_MS };
    this.logger.log({ event: 'pricing.profit_sheet.loaded', rows: records.length });
    return catalog;
  }

  refresh() {
    return this.getCatalog(true);
  }

  private async fetchRecords() {
    const spreadsheetId = this.configService
      .get<string>('GOOGLE_SHEETS_PROFIT_SPREADSHEET_ID')
      ?.trim();
    const range = this.configService.get<string>('GOOGLE_SHEETS_PROFIT_RANGE')?.trim();
    const clientEmail = this.configService.get<string>('GOOGLE_SHEETS_CLIENT_EMAIL')?.trim();
    const privateKey = this.configService.get<string>('GOOGLE_SHEETS_PRIVATE_KEY');

    if (!spreadsheetId || !range) {
      throw new Error(
        'Fonte de lucro liquido nao configurada. Informe GOOGLE_SHEETS_PROFIT_SPREADSHEET_ID e GOOGLE_SHEETS_PROFIT_RANGE.',
      );
    }
    if (!clientEmail || !privateKey) {
      throw new Error(
        'Credenciais do Google Sheets nao configuradas para a fonte de lucro liquido.',
      );
    }

    const token = await createGoogleSheetsAccessToken(clientEmail, privateKey);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId,
    )}/values/${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      throw new Error(`Planilha de lucro liquido respondeu com status ${response.status}.`);
    }

    const payload = (await response.json()) as GoogleValuesResponse;
    return mapProfitSheetValues(payload.values ?? []);
  }
}

export function mapProfitSheetValues(values: unknown[][]): ProfitSheetRecord[] {
  if (!values.length) return [];

  const headers = values[0]!.map((value) => normalizeHeader(String(value ?? '')));
  const indexByHeader = new Map(headers.map((header, index) => [header, index]));
  const missing = PROFIT_SHEET_HEADERS.filter((header) => !indexByHeader.has(header));
  if (missing.length) {
    throw new Error(`Cabecalhos obrigatorios ausentes na planilha de lucro: ${missing.join(', ')}`);
  }

  return values
    .slice(1)
    .filter(hasContent)
    .map((row, rowIndex) => {
      const value = (header: (typeof PROFIT_SHEET_HEADERS)[number]) =>
        String(row[indexByHeader.get(header)!] ?? '').trim();
      const condition = normalizeProfitCondition(value('condicao_produto'));
      const productDescription = value('produto_descricao');
      const netProfit = parseBrazilianCurrency(value('lucro_liquido'));

      if (!condition) {
        throw new Error(`Condicao invalida na linha ${rowIndex + 2} da planilha de lucro.`);
      }
      if (!productDescription) {
        throw new Error(`Descricao ausente na linha ${rowIndex + 2} da planilha de lucro.`);
      }
      if (netProfit === null) {
        throw new Error(`Lucro liquido invalido na linha ${rowIndex + 2} da planilha de lucro.`);
      }

      return {
        productId: value('produto_id'),
        condition,
        productDescription,
        normalizedDescription: normalizeProfitProductDescription(productDescription),
        netProfit,
      };
    });
}

export function lookupProfit(
  catalog: ProfitSheetCatalog,
  condition: ProfitCondition,
  productDescription: string,
): ProfitLookupResult {
  const normalizedDescription = normalizeProfitProductDescription(productDescription);
  const matches = catalog.records.filter(
    (record) =>
      record.condition === condition && record.normalizedDescription === normalizedDescription,
  );

  if (!matches.length) return { status: 'not_found' };
  if (matches.length > 1) return { status: 'duplicate', records: matches };
  return { status: 'found', record: matches[0]! };
}

export function normalizeProfitProductDescription(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)\s*["\u201c\u201d\u2033]/g, '$1 pol ')
    .replace(/\b(polegadas?|inches?|inch)\b/g, 'pol')
    .replace(/\b(\d+)\s*(gb|tb)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseBrazilianCurrency(value: string): number | null {
  const clean = value.trim().replace(/[^0-9,.-]/g, '');
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProfitCondition(value: string): ProfitCondition | null {
  const normalized = value.trim().toUpperCase();
  return normalized === 'NOVO' || normalized === 'SEMINOVO' || normalized === 'CPO'
    ? normalized
    : null;
}

async function createGoogleSheetsAccessToken(clientEmail: string, rawPrivateKey: string) {
  const privateKey = rawPrivateKey.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
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
    throw new Error('Nao foi possivel autenticar a fonte de lucro liquido no Google Sheets.');
  }
  return payload.access_token;
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
