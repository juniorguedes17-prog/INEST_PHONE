import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  ExportIntegrationDto,
  ImportIntegrationDto,
  WhatsappMessageDto,
} from '../dto/integrations.dto';
import { ExportProvider } from '../interfaces/export-provider.interface';
import {
  IntegrationProvider,
  IntegrationResult,
} from '../interfaces/integration-provider.interface';
import { ComprasParaguaiIntegrationProvider } from '../providers/compras-paraguai-integration.provider';
import {
  CsvExportProvider,
  ExcelExportProvider,
  PdfExportProvider,
} from '../providers/export.providers';
import { GoogleSheetsProvider } from '../providers/google-sheets.provider';
import { WhatsappProvider } from '../providers/whatsapp.provider';
import { IntegrationsRepository } from '../repository/integrations.repository';
import { withRetry } from '../utils/retry.util';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);
  private readonly cache = new Map<string, { expiresAt: number; value: unknown }>();

  constructor(
    @Inject(IntegrationsRepository) private readonly repository: IntegrationsRepository,
    @Inject(GoogleSheetsProvider) private readonly googleSheetsProvider: GoogleSheetsProvider,
    @Inject(WhatsappProvider) private readonly whatsappProvider: WhatsappProvider,
    @Inject(ComprasParaguaiIntegrationProvider)
    private readonly comprasParaguaiProvider: ComprasParaguaiIntegrationProvider,
    @Inject(CsvExportProvider) private readonly csvExportProvider: CsvExportProvider,
    @Inject(ExcelExportProvider) private readonly excelExportProvider: ExcelExportProvider,
    @Inject(PdfExportProvider) private readonly pdfExportProvider: PdfExportProvider,
  ) {}

  async status() {
    return this.cached('status', async () => {
      const providers = await Promise.all(this.providers.map((provider) => provider.status()));
      const configurations = await this.repository.listConfigurations();
      return this.providers.map((provider, index) => ({
        key: provider.key,
        name: provider.name,
        type: provider.type,
        status: providers[index],
        lastConfiguration: configurations.find((item) => item.key === provider.key)?.value ?? null,
      }));
    });
  }

  async test(providerKey: string, user: AuthenticatedUser) {
    const startedAt = Date.now();
    const provider = this.getProvider(providerKey);
    const result = await this.executeWithLog(() => provider.testConnection(), provider.key, 'test');
    await this.audit(user.id, 'UPDATE', provider.key, result, Date.now() - startedAt);
    return result;
  }

  async sync(providerKey: string, user: AuthenticatedUser) {
    const startedAt = Date.now();
    const provider = this.getProvider(providerKey);
    const result = provider.sync
      ? await this.executeWithLog(() => provider.sync!(), provider.key, 'sync')
      : { success: true, message: 'Provider sem rotina de sincronizacao.' };
    await this.audit(user.id, 'IMPORT', provider.key, result, Date.now() - startedAt);
    this.invalidateCache();
    return result;
  }

  async importData(dto: ImportIntegrationDto, user: AuthenticatedUser) {
    const result = {
      success: true,
      message: `Importacao ${dto.source} preparada.`,
      data: { source: dto.source, received: Boolean(dto.content) },
    };
    await this.audit(user.id, 'IMPORT', dto.source, result, 0);
    return result;
  }

  async export(dto: ExportIntegrationDto, user: AuthenticatedUser) {
    const provider = this.getExportProvider(dto.format);
    const artifact = await provider.export(dto.dataset ?? 'integrations');
    await this.audit(user.id, 'EXPORT', dto.format, artifact, 0);
    return artifact;
  }

  whatsappLink(dto: WhatsappMessageDto) {
    return { url: this.whatsappProvider.createMessageLink(dto.message) };
  }

  jobs() {
    return [
      { key: 'update_dollar', name: 'Atualizar dolar', status: 'prepared' },
      { key: 'sync_google_sheets', name: 'Atualizar Google Sheets', status: 'prepared' },
      { key: 'sync_suppliers', name: 'Sincronizar fornecedores', status: 'prepared' },
      { key: 'clear_cache', name: 'Limpar cache', status: 'prepared' },
    ];
  }

  history() {
    return this.repository.listHistory();
  }

  invalidateCache() {
    this.cache.clear();
    return { success: true, message: 'Cache de integracoes invalidado.' };
  }

  private async executeWithLog(
    action: () => Promise<IntegrationResult>,
    providerKey: string,
    actionName: string,
  ) {
    const start = Date.now();
    try {
      const result = await withRetry(action, { retries: 2, timeoutMs: 5000 });
      this.logger.log({ providerKey, actionName, durationMs: Date.now() - start, success: true });
      return { ...result, durationMs: Date.now() - start };
    } catch (error) {
      this.logger.error({ providerKey, actionName, error, durationMs: Date.now() - start });
      throw error;
    }
  }

  private async audit(
    userId: string,
    operationType: 'IMPORT' | 'EXPORT' | 'UPDATE' | 'ERROR',
    entityId: string,
    payload: unknown,
    durationMs: number,
  ) {
    await this.repository.createAuditLog({
      userId,
      operationType,
      entityId,
      newValue: payload,
      context: { event: 'integrations.operation', durationMs },
    });
  }

  private async cached<T>(key: string, factory: () => Promise<T>) {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    const value = await factory();
    this.cache.set(key, { value, expiresAt: Date.now() + 60_000 });
    return value;
  }

  private getProvider(providerKey: string): IntegrationProvider {
    const provider = this.providers.find((item) => item.key === providerKey);
    if (!provider) {
      throw new NotFoundException('Provider de integracao nao encontrado.');
    }
    return provider;
  }

  private getExportProvider(format: string): ExportProvider {
    const provider = this.exportProviders.find((item) => item.format === format);
    if (!provider) {
      throw new NotFoundException('Provider de exportacao nao encontrado.');
    }
    return provider;
  }

  private get providers(): IntegrationProvider[] {
    return [this.googleSheetsProvider, this.whatsappProvider, this.comprasParaguaiProvider];
  }

  private get exportProviders(): ExportProvider[] {
    return [this.csvExportProvider, this.excelExportProvider, this.pdfExportProvider];
  }
}
