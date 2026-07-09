import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationResult,
} from '../interfaces/integration-provider.interface';

@Injectable()
export class ComprasParaguaiIntegrationProvider implements IntegrationProvider {
  readonly key = 'compras_paraguai';
  readonly name = 'Compras Paraguai';
  readonly type = 'marketplace' as const;

  async status(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Provider preparado. Sem scraping definitivo nesta etapa.',
      data: { mode: 'prepared_provider' },
    };
  }

  async testConnection(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Provider disponivel em modo preparado/mock.',
    };
  }

  async sync(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Sincronizacao preparada para futura API ou scraping controlado.',
    };
  }
}
