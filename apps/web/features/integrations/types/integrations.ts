export interface IntegrationStatus {
  key: string;
  name: string;
  type: string;
  status: {
    success: boolean;
    message: string;
    data?: unknown;
    durationMs?: number;
  };
  lastConfiguration?: string | null;
}

export interface IntegrationJob {
  key: string;
  name: string;
  status: string;
}

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}
