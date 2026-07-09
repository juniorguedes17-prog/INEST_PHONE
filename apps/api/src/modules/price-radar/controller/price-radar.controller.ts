import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CreatePriceQuoteDto,
  CsvImportDto,
  PriceRadarQueryDto,
  UpdatePriceQuoteDto,
  ValidateQuoteDto,
} from '../dto/price-radar.dto';
import { PriceRadarService } from '../service/price-radar.service';

@ApiTags('Price Radar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('price-radar')
export class PriceRadarController {
  constructor(@Inject(PriceRadarService) private readonly priceRadarService: PriceRadarService) {}

  @Get('quotes')
  @ApiOperation({ summary: 'Lista cotacoes do Radar de Precos.' })
  list(@Query() query: PriceRadarQueryDto) {
    return this.priceRadarService.list(query);
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Retorna indicadores do Radar de Precos.' })
  kpis(@Query() query: PriceRadarQueryDto) {
    return this.priceRadarService.kpis(query);
  }

  @Get('quotes/:id')
  findOne(@Param('id') id: string) {
    return this.priceRadarService.findOne(id);
  }

  @Post('quotes')
  create(@Body() dto: CreatePriceQuoteDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceRadarService.create(dto, user);
  }

  @Patch('quotes/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePriceQuoteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.priceRadarService.update(id, dto, user);
  }

  @Patch('quotes/:id/hide')
  hide(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.priceRadarService.hide(id, user);
  }

  @Post('import/csv')
  importCsv(@Body() dto: CsvImportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.priceRadarService.importCsv(dto, user);
  }

  @Post('import/excel')
  importExcel() {
    return this.priceRadarService.importExcel();
  }

  @Post('validate')
  validate(@Body() dto: ValidateQuoteDto) {
    return this.priceRadarService.validate(dto);
  }
}
