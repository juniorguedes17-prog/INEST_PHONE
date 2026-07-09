export interface IntegrationResult {
  success: boolean;
  message: string;
  data?: unknown;
  durationMs?: number;
}

export interface IntegrationProvider {
  readonly key: string;
  readonly name: string;
  readonly type: 'google_sheets' | 'whatsapp' | 'marketplace' | 'export' | 'import';
  status(): Promise<IntegrationResult>;
  testConnection(): Promise<IntegrationResult>;
  sync?(): Promise<IntegrationResult>;
}
