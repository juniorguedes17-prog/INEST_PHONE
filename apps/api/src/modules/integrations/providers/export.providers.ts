import { Injectable } from '@nestjs/common';
import { ExportArtifact, ExportProvider } from '../interfaces/export-provider.interface';

@Injectable()
export class CsvExportProvider implements ExportProvider {
  readonly format = 'csv';

  async export(dataset: string): Promise<ExportArtifact> {
    return {
      filename: `${dataset || 'export'}.csv`,
      mimeType: 'text/csv',
      content: 'tipo,descricao\nexportacao,conteudo preparado para CSV\n',
      encoding: 'utf-8',
    };
  }
}

@Injectable()
export class ExcelExportProvider implements ExportProvider {
  readonly format = 'excel';

  async export(dataset: string): Promise<ExportArtifact> {
    return {
      filename: `${dataset || 'export'}.xls`,
      mimeType: 'application/vnd.ms-excel',
      content:
        '<table><tr><th>tipo</th><th>descricao</th></tr><tr><td>exportacao</td><td>conteudo preparado para Excel</td></tr></table>',
      encoding: 'utf-8',
    };
  }
}

@Injectable()
export class PdfExportProvider implements ExportProvider {
  readonly format = 'pdf';

  async export(dataset: string): Promise<ExportArtifact> {
    return {
      filename: `${dataset || 'export'}.pdf`,
      mimeType: 'application/pdf',
      content: Buffer.from(`PDF preparado para exportacao: ${dataset || 'export'}`).toString(
        'base64',
      ),
      encoding: 'base64',
    };
  }
}
