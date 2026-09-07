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
  ServiceUnavailableException,
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
import { UsaCostPreflightDto } from '../dto/usa-cost-preflight.dto';
import type { UsaSourceProduct } from '../usa-source-product.adapter';
import {
  RegisterShippingWeightDto,
  ResolveShippingWeightDto,
} from '../shipping-weights/shipping-weight-registration.dto';
import { ShippingWeightRegistrationService } from '../shipping-weights/shipping-weight-registration.service';
import { ImportRadarService } from '../service/import-radar.service';
import { UsaEnrichmentInputDecisionService } from '../service/usa-enrichment-input-decision.service';
import { UsaCostPreflightService } from '../service/usa-cost-preflight.service';
import { UsaCostExecutionService } from '../service/usa-cost-execution.service';
import { UsaPricedOfferService } from '../service/usa-priced-offer.service';
import { UsaProvidersOrchestrator } from '../service/usa-providers-orchestrator.service';

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
    @Optional()
    @Inject(UsaCostPreflightService)
    private readonly usaCostPreflightService?: UsaCostPreflightService,
    @Optional()
    @Inject(UsaCostExecutionService)
    private readonly usaCostExecutionService?: UsaCostExecutionService,
    @Optional()
    @Inject(UsaProvidersOrchestrator)
    private readonly usaProvidersOrchestrator?: UsaProvidersOrchestrator,
    @Optional()
    @Inject(UsaPricedOfferService)
    private readonly usaPricedOfferService?: UsaPricedOfferService,
  ) {}

  @Get('search')
  @ApiOperation({ summary: 'Pesquisa produtos internacionais por provider.' })
  search(@Query() query: ImportSearchQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.importRadarService.search(query, user);
  }

  @Get('usa/search/diagnostics')
  @ApiOperation({ summary: 'Pesquisa USA com diagnóstico parcial das fontes.' })
  searchUsaWithDiagnostics(@Query() query: ImportSearchQueryDto) {
    if (!this.usaProvidersOrchestrator)
      throw new ServiceUnavailableException('USA discovery unavailable.');
    return this.usaProvidersOrchestrator.searchWithDiagnostics(query);
  }

  @Get('usa/search')
  @ApiOperation({ summary: 'Pesquisa produtos USA nos providers homologados.' })
  searchUsa(@Query() query: ImportSearchQueryDto) {
    if (!this.usaProvidersOrchestrator) {
      throw new Error('Orquestrador de providers USA indisponivel.');
    }
    return this.usaProvidersOrchestrator.search(query);
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

  @Post('usa-cost-preflight')
  @ApiOperation({ summary: 'Verifica se um produto USA esta pronto para custo.' })
  preflightUsaCost(@Body() dto: UsaCostPreflightDto) {
    if (!this.usaCostPreflightService) {
      throw new Error('Servico de preflight USA indisponivel.');
    }
    return this.usaCostPreflightService.preflight({
      sourceProduct: dto.sourceProduct as UsaSourceProduct,
      redirector:
        dto.redirector.redirector === 'RED_DELAWARE'
          ? {
              redirector: 'RED_DELAWARE',
              shippingMode: dto.redirector.shippingMode as 'EXPRESS',
            }
          : { redirector: 'REI_DO_IMPORTADO' },
      composition: dto.composition,
    });
  }

  @Post('usa-cost')
  @ApiOperation({ summary: 'Executa o custo USA somente apos preflight aprovado.' })
  executeUsaCost(@Body() dto: UsaCostPreflightDto) {
    if (!this.usaCostExecutionService) {
      throw new Error('Servico de custo USA indisponivel.');
    }
    return this.usaCostExecutionService.execute({
      sourceProduct: dto.sourceProduct as UsaSourceProduct,
      redirector:
        dto.redirector.redirector === 'RED_DELAWARE'
          ? {
              redirector: 'RED_DELAWARE',
              shippingMode: dto.redirector.shippingMode as 'EXPRESS',
            }
          : { redirector: 'REI_DO_IMPORTADO' },
      composition: dto.composition,
    });
  }

  @Post('usa-priced-offer')
  @ApiOperation({ summary: 'Executa o fluxo USA ate Pricing e Offer.' })
  executeUsaPricedOffer(@Body() dto: UsaCostPreflightDto, @CurrentUser() user: AuthenticatedUser) {
    if (!this.usaPricedOfferService) {
      throw new Error('Servico de oferta precificada USA indisponivel.');
    }
    return this.usaPricedOfferService.execute({
      sourceProduct: dto.sourceProduct as UsaSourceProduct,
      redirector:
        dto.redirector.redirector === 'RED_DELAWARE'
          ? {
              redirector: 'RED_DELAWARE',
              shippingMode: dto.redirector.shippingMode as 'EXPRESS',
            }
          : { redirector: 'REI_DO_IMPORTADO' },
      composition: dto.composition,
      user,
    });
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
