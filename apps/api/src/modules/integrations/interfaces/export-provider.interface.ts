export interface ExportArtifact {
  filename: string;
  mimeType: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface ExportProvider {
  readonly format: string;
  export(dataset: string): Promise<ExportArtifact>;
}
