import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { DashboardQueryDto } from '../dto/dashboard.dto';
import { DashboardService } from '../service/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(@Inject(DashboardService) private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'Retorna snapshot completo do Dashboard Gerencial.' })
  overview(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.overview(query, user);
  }

  @Get('kpis')
  kpis(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.kpis(query, user);
  }

  @Get('financial')
  financial(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.financial(query, user);
  }

  @Get('radar')
  radar(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.radar(query, user);
  }

  @Get('importation')
  importation(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.importation(query, user);
  }

  @Get('offers')
  offers(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.offers(query, user);
  }

  @Get('products')
  products(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.products(query, user);
  }

  @Get('suppliers')
  suppliers(@Query() query: DashboardQueryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.dashboardService.suppliers(query, user);
  }
}
