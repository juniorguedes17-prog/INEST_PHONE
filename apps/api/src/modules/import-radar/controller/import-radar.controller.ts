import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Optional,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CalculateImportCostDto,
  ConfirmImportManufacturerDto,
  ImportSearchQueryDto,
  UpdateDollarQuoteDto,
} from '../dto/import-radar.dto';
import {
  UsaEnrichmentDecisionDto,
  UsaManufacturerConfirmationDto,
} from '../dto/usa-enrichment.dto';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  RegisterShippingWeightDto,
  ResolveShippingWeightDto,
} from '../shipping-weights/shipping-weight-registration.dto';
import { ShippingWeightRegistrationService } from '../shipping-weights/shipping-weight-registration.service';
import { ImportRadarService } from '../service/import-radar.service';
import { UsaEnrichmentInputDecisionService } from '../service/usa-enrichment-input-decision.service';

@ApiTags('Import Radar')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('import-radar')
export class ImportRadarController {
  constructor(
    @Inject(ImportRadarService) private readonly importRadarService: ImportRadarService,
    @Inject(ShippingWeightRegistrationService)
    private readonly shippingWeightRegistrationService: ShippingWeightRegistrationService,
    @Optional()
    @Inject(UsaEnrichmentInputDecisionService)
    private readonly usaEnrichmentInputDecisionService?: UsaEnrichmentInputDecisionService,
  ) {}

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

  @Post('confirm-manufacturer')
  @UseGuards(PermissionsGuard)
  @Permissions('settings:configure')
  @ApiOperation({
    summary: 'Confirma fabricante externo e recalcula somente o item de importacao.',
  })
  confirmManufacturer(
    @Body() dto: ConfirmImportManufacturerDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importRadarService.confirmManufacturer(dto, user);
  }

  @Post('usa-enrichment/resolve')
  @ApiOperation({ summary: 'Resolve lacunas semanticas de um Source Product USA.' })
  resolveUsaEnrichment(@Body() dto: UsaEnrichmentDecisionDto) {
    if (!this.usaEnrichmentInputDecisionService) {
      throw new Error('Servico de decisoes de enriquecimento USA indisponivel.');
    }
    return this.usaEnrichmentInputDecisionService.resolve(dto.sourceProduct as UsaSourceProduct);
  }

  @Post('usa-enrichment/confirm-manufacturer')
  @UseGuards(PermissionsGuard)
  @Permissions('settings:configure')
  @ApiOperation({ summary: 'Confirma fabricante USA e reprocessa somente o item atual.' })
  confirmUsaManufacturer(
    @Body() dto: UsaManufacturerConfirmationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!this.usaEnrichmentInputDecisionService) {
      throw new Error('Servico de decisoes de enriquecimento USA indisponivel.');
    }
    return this.usaEnrichmentInputDecisionService.confirmManufacturer(
      dto.sourceProduct as UsaSourceProduct,
      { canonicalName: dto.canonicalName, alias: dto.alias },
      user,
    );
  }

  @Post('shipping-weights')
  @UseGuards(PermissionsGuard)
  @Permissions('products:edit')
  @ApiOperation({ summary: 'Confirma peso operacional de envio para uma identidade logistica.' })
  registerShippingWeight(
    @Body() dto: RegisterShippingWeightDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.shippingWeightRegistrationService.register(dto, user);
  }

  @Post('shipping-weights/resolve')
  @ApiOperation({ summary: 'Consulta a decisao de peso operacional de envio sem persistir dados.' })
  resolveShippingWeight(@Body() dto: ResolveShippingWeightDto) {
    return this.shippingWeightRegistrationService.resolve(dto);
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
