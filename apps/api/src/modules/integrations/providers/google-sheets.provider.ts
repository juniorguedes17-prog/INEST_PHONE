import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationResult,
} from '../interfaces/integration-provider.interface';

@Injectable()
export class GoogleSheetsProvider implements IntegrationProvider {
  readonly key = 'google_sheets';
  readonly name = 'Google Sheets';
  readonly type = 'google_sheets' as const;

  async status(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Provider preparado para consumir lucro por modelo e tabelas auxiliares.',
      data: { mode: 'prepared', credentialRequired: true },
    };
  }

  async testConnection(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Conexao simulada com sucesso. Credenciais reais ainda nao configuradas.',
    };
  }

  async sync(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Sincronizacao preparada em modo mock.',
      data: {
        modelProfits: [
          { model: 'iPhone 16 Pro Max', desiredNetProfit: 500 },
          { model: 'MacBook Air', desiredNetProfit: 800 },
        ],
      },
    };
  }
}
