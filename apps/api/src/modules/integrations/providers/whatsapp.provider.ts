import { Injectable } from '@nestjs/common';
import {
  IntegrationProvider,
  IntegrationResult,
} from '../interfaces/integration-provider.interface';

@Injectable()
export class WhatsappProvider implements IntegrationProvider {
  readonly key = 'whatsapp';
  readonly name = 'WhatsApp';
  readonly type = 'whatsapp' as const;

  async status(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Links estruturados ativos. API oficial preparada para etapa futura.',
      data: { mode: 'link_only' },
    };
  }

  async testConnection(): Promise<IntegrationResult> {
    return {
      success: true,
      message: 'Geracao de link WhatsApp disponivel.',
    };
  }

  createMessageLink(message: string) {
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }
}
