import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  GenerateOfferDraftDto,
  PricingQueryDto,
  TemporaryImportPricingDto,
  UpdateModelProfitDto,
} from '../dto/pricing.dto';
import { PricingService } from '../service/pricing.service';

@ApiTags('Pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(@Inject(PricingService) private readonly pricingService: PricingService) {}

  @Get()
  @ApiOperation({ summary: 'Lista precos calculados dinamicamente.' })
  list(@Query() query: PricingQueryDto) {
    return this.pricingService.list(query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Consulta preco calculado de um produto.' })
  findOne(@Param('productId') productId: string) {
    return this.pricingService.findOne(productId);
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'Recalcula precos sem persistir valores calculados.' })
  recalculate(@Body() query: PricingQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pricingService.recalculate(query, user);
  }

  @Patch('profits')
  @ApiOperation({ summary: 'Atualiza lucro liquido desejado por modelo.' })
  updateModelProfit(@Body() dto: UpdateModelProfitDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pricingService.updateModelProfit(dto, user);
  }

  @Post('generate-offer')
  @ApiOperation({ summary: 'Gera rascunho de oferta com dados calculados.' })
  generateOfferDraft(@Body() dto: GenerateOfferDraftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.pricingService.generateOfferDraft(dto, user);
  }

  @Post('temporary-import')
  @ApiOperation({ summary: 'Calcula precificacao temporaria para um item do Radar Paraguai.' })
  calculateTemporaryImport(@Body() dto: TemporaryImportPricingDto) {
    return this.pricingService.calculateTemporaryImport(dto);
  }
}
