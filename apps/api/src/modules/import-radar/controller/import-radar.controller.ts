import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CalculateImportCostDto,
  ImportSearchQueryDto,
  UpdateDollarQuoteDto,
} from '../dto/import-radar.dto';
import { ImportRadarService } from '../service/import-radar.service';

@ApiTags('Import Radar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import-radar')
export class ImportRadarController {
  constructor(@Inject(ImportRadarService) private readonly importRadarService: ImportRadarService) {}

  @Get('search')
  @ApiOperation({ summary: 'Pesquisa produtos internacionais por provider.' })
  search(@Query() query: ImportSearchQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.importRadarService.search(query, user);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Consulta produto encontrado pelo provider.' })
  findProduct(@Param('id') id: string, @Query() query: ImportSearchQueryDto) {
    return this.importRadarService.findProduct(id, query);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calcula custo estimado de importacao.' })
  calculate(@Body() dto: CalculateImportCostDto, @CurrentUser() user: AuthenticatedUser) {
    return this.importRadarService.calculate(dto, user);
  }

  @Get('history')
  @ApiOperation({ summary: 'Lista historico de pesquisas e calculos.' })
  history() {
    return this.importRadarService.history();
  }

  @Patch('dollar-quote')
  @ApiOperation({ summary: 'Atualiza cotacao do dolar nas configuracoes de importacao.' })
  updateDollarQuote(@Body() dto: UpdateDollarQuoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.importRadarService.updateDollarQuote(dto, user);
  }
}
