import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  BrazilRadarQuotePricingDto,
  ConfirmBrazilRadarManufacturerDto,
  GenerateOfferDraftDto,
  PricingQueryDto,
  ReplaceBrazilRadarWorkSnapshotDto,
  TemporaryImportPricingDto,
  UpdateModelProfitDto,
} from '../dto/pricing.dto';
import { PricingService } from '../service/pricing.service';
import { PricingWorkSnapshotService } from '../service/pricing-work-snapshot.service';

@ApiTags('Pricing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PricingService) private readonly pricingService: PricingService,
    @Inject(PricingWorkSnapshotService)
    private readonly pricingWorkSnapshots: PricingWorkSnapshotService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista precos calculados dinamicamente.' })
  list(@Query() query: PricingQueryDto) {
    return this.pricingService.list(query);
  }

  @Get('work-snapshot/radar')
  @ApiOperation({ summary: 'Retorna o conjunto atual do Radar Brasil para Precificação.' })
  workSnapshot(@CurrentUser() user: AuthenticatedUser) {
    return this.pricingWorkSnapshots.get(user);
  }

  @Put('work-snapshot/radar')
  @ApiOperation({ summary: 'Substitui o conjunto atual do Radar Brasil para Precificação.' })
  replaceWorkSnapshot(
    @Body() dto: ReplaceBrazilRadarWorkSnapshotDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pricingWorkSnapshots.replaceFromRadar(dto, user);
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

  @Post('radar-quote')
  @ApiOperation({ summary: 'Prepara uma cotacao do Radar Brasil para Precificacao.' })
  calculateBrazilRadarQuote(@Body() dto: BrazilRadarQuotePricingDto) {
    return this.pricingService.calculateBrazilRadarQuote(dto);
  }

  @Post('radar-quote/confirm-manufacturer')
  @UseGuards(PermissionsGuard)
  @Permissions('settings:configure')
  @ApiOperation({ summary: 'Confirma fabricante externo e recalcula somente a cotacao BR.' })
  confirmBrazilRadarManufacturer(
    @Body() dto: ConfirmBrazilRadarManufacturerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pricingService.confirmBrazilRadarManufacturer(dto, user);
  }
}
