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
  const exactMatches = catalog.records.filter(
    (record) =>
      record.condition === condition && record.normalizedDescription === normalizedDescription,
  );

  if (exactMatches.length > 1) return { status: 'duplicate', records: exactMatches };
  if (exactMatches.length === 1) return { status: 'found', record: exactMatches[0]! };

  const flexibleMatches = catalog.records.filter(
    (record) =>
      record.condition === condition &&
      isCompatibleAppleProductDescription(normalizedDescription, record.normalizedDescription),
  );

  if (!flexibleMatches.length) return { status: 'not_found' };
  if (flexibleMatches.length > 1) return { status: 'duplicate', records: flexibleMatches };
  return { status: 'found', record: flexibleMatches[0]! };
}

export function normalizeProfitProductDescription(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/(\d)\s*["\u201c\u201d\u2033]/g, '$1 pol ')
    .replace(/\b(polegadas?|inches?|inch)\b/g, 'pol')
    .replace(/\b(\d+)\s*(gb|tb)\b/g, '$1$2')
    .replace(/\b(\d+)\s*(w|mm|m)\b/g, '$1$2')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isCompatibleAppleProductDescription(source: string, candidate: string) {
  return (
    isCompatibleMacBookDescription(source, candidate) ||
    isCompatibleIPhoneDescription(source, candidate) ||
    isCompatibleAppleWatchDescription(source, candidate) ||
    isCompatibleAirPodsDescription(source, candidate) ||
    isCompatibleMacMiniDescription(source, candidate) ||
    isCompatibleAppleAccessoryDescription(source, candidate)
  );
}

function isCompatibleMacBookDescription(source: string, candidate: string) {
  const sourceDetails = getMacBookDetails(source);
  const candidateDetails = getMacBookDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  if (sourceDetails.family !== candidateDetails.family) return false;
  if (!sameValues(sourceDetails.memoryAndStorage, candidateDetails.memoryAndStorage)) return false;
  if (sourceDetails.chip !== candidateDetails.chip) return false;
  if (sourceDetails.chipVariant !== candidateDetails.chipVariant) return false;
  if (
    sourceDetails.screenSize &&
    candidateDetails.screenSize &&
    sourceDetails.screenSize !== candidateDetails.screenSize
  ) {
    return false;
  }
  if (
    sourceDetails.year &&
    candidateDetails.year &&
    sourceDetails.year !== candidateDetails.year
  ) {
    return false;
  }

  return true;
}

function getMacBookDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const family = tokens.find((token) => token === 'air' || token === 'pro' || token === 'neo');
  if (!tokens.includes('macbook') || !family) return null;

  const chipIndex = tokens.findIndex((token) => /^(?:a|m)\d+$/.test(token));
  const chip = chipIndex >= 0 ? tokens[chipIndex] : undefined;
  if (!chip) return null;

  const memoryAndStorage = Array.from(
    new Set(tokens.filter((token) => /^\d+(?:\.\d+)?(?:gb|tb)$/.test(token))),
  ).sort();
  if (!memoryAndStorage.length) return null;

  return {
    family,
    chip,
    chipVariant: getMacBookChipVariant(tokens[chipIndex + 1]),
    memoryAndStorage,
    screenSize: tokens.find((token) => /^(?:11|12|13|14|15|16)(?:\.\d+)?$/.test(token)),
    year: tokens.find((token) => /^20\d{2}$/.test(token)),
  };
}

function getMacBookChipVariant(value: string | undefined) {
  return value === 'pro' || value === 'max' || value === 'ultra' ? value : undefined;
}

function isCompatibleIPhoneDescription(source: string, candidate: string) {
  const sourceDetails = getIPhoneDetails(source);
  const candidateDetails = getIPhoneDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  return (
    sourceDetails.generation === candidateDetails.generation &&
    sameValues(sourceDetails.variants, candidateDetails.variants) &&
    sameValues(sourceDetails.memoryAndStorage, candidateDetails.memoryAndStorage)
  );
}

function getIPhoneDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const iPhoneIndex = tokens.indexOf('iphone');
  const generation = tokens[iPhoneIndex + 1];
  if (iPhoneIndex < 0 || !generation || !/^\d+[a-z]*$/.test(generation)) return null;

  const memoryAndStorage = getMemoryAndStorage(tokens);
  if (!memoryAndStorage.length) return null;

  return {
    generation,
    variants: getTokenValues(tokens.slice(iPhoneIndex + 2), ['pro', 'max', 'plus', 'mini', 'air']),
    memoryAndStorage,
  };
}

function isCompatibleAppleWatchDescription(source: string, candidate: string) {
  const sourceDetails = getAppleWatchDetails(source);
  const candidateDetails = getAppleWatchDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  return (
    sourceDetails.family === candidateDetails.family &&
    sourceDetails.generation === candidateDetails.generation &&
    sourceDetails.caseSize === candidateDetails.caseSize &&
    sourceDetails.connectivity === candidateDetails.connectivity
  );
}

function getAppleWatchDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const watchIndex = tokens.findIndex(
    (token, index) => token === 'watch' && tokens[index - 1] === 'apple',
  );
  if (watchIndex < 0) return null;

  const familyToken = tokens[watchIndex + 1];
  const isKnownFamily = familyToken === 'series' || familyToken === 'ultra' || familyToken === 'se';
  const family = isKnownFamily ? familyToken : 'standard';
  const generation = tokens[watchIndex + (isKnownFamily ? 2 : 1)];
  const caseSize = tokens.find((token) => /^\d+(?:\.\d+)?mm$/.test(token));
  if (!generation || !/^\d+$/.test(generation) || !caseSize) return null;

  return {
    family,
    generation,
    caseSize,
    connectivity: getConnectivity(tokens),
  };
}

function isCompatibleAirPodsDescription(source: string, candidate: string) {
  const sourceDetails = getAirPodsDetails(source);
  const candidateDetails = getAirPodsDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  return (
    sourceDetails.family === candidateDetails.family &&
    sourceDetails.generation === candidateDetails.generation &&
    sameValues(sourceDetails.features, candidateDetails.features)
  );
}

function getAirPodsDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const airPodsIndex = tokens.indexOf('airpods');
  if (airPodsIndex < 0) return null;

  const followingTokens = tokens.slice(airPodsIndex + 1);
  const family = followingTokens[0] === 'pro' || followingTokens[0] === 'max' ? followingTokens[0] : 'standard';
  const generation = followingTokens.find((token) => /^\d+$/.test(token));
  if (!generation && family !== 'max') return null;

  return {
    family,
    generation,
    features: getTokenValues(followingTokens, ['anc', 'usb', 'lightning', 'magsafe']),
  };
}

function isCompatibleMacMiniDescription(source: string, candidate: string) {
  const sourceDetails = getMacMiniDetails(source);
  const candidateDetails = getMacMiniDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  return (
    sourceDetails.chip === candidateDetails.chip &&
    sourceDetails.chipVariant === candidateDetails.chipVariant &&
    sameValues(sourceDetails.memoryAndStorage, candidateDetails.memoryAndStorage)
  );
}

function getMacMiniDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const miniIndex = tokens.findIndex(
    (token, index) => token === 'mini' && tokens[index - 1] === 'mac',
  );
  if (miniIndex < 0) return null;

  const chipIndex = tokens.findIndex((token) => /^(?:a|m)\d+$/.test(token));
  const chip = chipIndex >= 0 ? tokens[chipIndex] : undefined;
  const memoryAndStorage = getMemoryAndStorage(tokens);
  if (!chip || !memoryAndStorage.length) return null;

  return {
    chip,
    chipVariant: getMacBookChipVariant(tokens[chipIndex + 1]),
    memoryAndStorage,
  };
}

function isCompatibleAppleAccessoryDescription(source: string, candidate: string) {
  const sourceDetails = getAppleAccessoryDetails(source);
  const candidateDetails = getAppleAccessoryDetails(candidate);
  if (!sourceDetails || !candidateDetails) return false;

  return (
    sourceDetails.family === candidateDetails.family &&
    sameValues(sourceDetails.identifiers, candidateDetails.identifiers)
  );
}

function getAppleAccessoryDetails(description: string) {
  const tokens = description.split(' ').filter(Boolean);
  const family = getAppleAccessoryFamily(tokens);
  if (!family) return null;

  const identifiers = [
    ...getTokenValues(tokens, [
      'pro',
      'max',
      'ultra',
      'usb',
      'lightning',
      'magsafe',
      'touch',
      'id',
      'numeric',
      'keypad',
      'abnt',
      'br',
      'us',
      'pt',
    ]),
    ...tokens.filter((token) => /^\d+(?:\.\d+)?(?:w|mm|m)$/.test(token)),
  ].sort();

  return identifiers.length ? { family, identifiers } : null;
}

function getAppleAccessoryFamily(tokens: string[]) {
  if (tokens.includes('airtag')) return 'airtag';
  if (tokens.includes('pencil')) return 'apple-pencil';
  if (tokens.includes('mouse') && tokens.includes('magic')) return 'magic-mouse';
  if (tokens.includes('keyboard') && tokens.includes('magic')) return 'magic-keyboard';
  if (tokens.includes('trackpad') && tokens.includes('magic')) return 'magic-trackpad';
  if (tokens.includes('magsafe') && tokens.includes('charger')) return 'magsafe-charger';
  if (tokens.includes('adapter')) return 'power-adapter';
  if (tokens.includes('cable')) return 'cable';
  return null;
}

function getMemoryAndStorage(tokens: string[]) {
  return Array.from(
    new Set(tokens.filter((token) => /^\d+(?:\.\d+)?(?:gb|tb)$/.test(token))),
  ).sort();
}

function getTokenValues(tokens: string[], allowedValues: string[]) {
  return Array.from(new Set(tokens.filter((token) => allowedValues.includes(token)))).sort();
}

function getConnectivity(tokens: string[]) {
  if (tokens.includes('cellular') || tokens.includes('lte')) return 'cellular';
  if (tokens.includes('gps')) return 'gps';
  return 'unknown';
}

function sameValues(first: string[], second: string[]) {
  return first.length === second.length && first.every((value, index) => value === second[index]);
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
