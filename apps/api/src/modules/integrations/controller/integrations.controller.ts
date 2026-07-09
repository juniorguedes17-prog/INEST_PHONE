import { Body, Controller, Delete, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  ExportIntegrationDto,
  ImportIntegrationDto,
  WhatsappMessageDto,
} from '../dto/integrations.dto';
import { IntegrationsService } from '../service/integrations.service';

@ApiTags('Integrations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integrations')
export class IntegrationsController {
  constructor(@Inject(IntegrationsService) private readonly integrationsService: IntegrationsService) {}

  @Get('status')
  @ApiOperation({ summary: 'Consulta status dos providers de integracao.' })
  status() {
    return this.integrationsService.status();
  }

  @Post(':provider/test')
  @ApiOperation({ summary: 'Testa conexao de provider.' })
  test(@Param('provider') provider: string, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.test(provider, user);
  }

  @Post(':provider/sync')
  @ApiOperation({ summary: 'Executa sincronizacao preparada de provider.' })
  sync(@Param('provider') provider: string, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.sync(provider, user);
  }

  @Post('import')
  @ApiOperation({ summary: 'Prepara importacao por CSV, Excel ou Google Sheets.' })
  importData(@Body() dto: ImportIntegrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.importData(dto, user);
  }

  @Post('export')
  @ApiOperation({ summary: 'Gera exportacao em CSV, Excel ou PDF.' })
  export(@Body() dto: ExportIntegrationDto, @CurrentUser() user: AuthenticatedUser) {
    return this.integrationsService.export(dto, user);
  }

  @Post('whatsapp/link')
  @ApiOperation({ summary: 'Gera link estruturado de WhatsApp.' })
  whatsappLink(@Body() dto: WhatsappMessageDto) {
    return this.integrationsService.whatsappLink(dto);
  }

  @Get('jobs')
  @ApiOperation({ summary: 'Lista jobs preparados para scheduler futuro.' })
  jobs() {
    return this.integrationsService.jobs();
  }

  @Get('history')
  @ApiOperation({ summary: 'Lista historico de integracoes.' })
  history() {
    return this.integrationsService.history();
  }

  @Delete('cache')
  @ApiOperation({ summary: 'Invalida cache de integracoes.' })
  invalidateCache() {
    return this.integrationsService.invalidateCache();
  }
}
