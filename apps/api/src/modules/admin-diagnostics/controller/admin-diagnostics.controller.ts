import { Controller, Get, Inject, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ADMINISTRATOR_ROLE } from '../../users/users.constants';
import { AdminDiagnosticsService } from '../service/admin-diagnostics.service';

// TEMPORARY VM1 DIAGNOSTIC — REMOVE AFTER PRODUCTION VALIDATION
@ApiTags('Admin Diagnostics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMINISTRATOR_ROLE)
@Controller('admin/diagnostics')
export class AdminDiagnosticsController {
  constructor(
    @Inject(AdminDiagnosticsService)
    private readonly diagnosticsService: AdminDiagnosticsService,
  ) {}

  @Get('vm1-readiness')
  @ApiOperation({ summary: 'Audita temporariamente a prontidao da VM1.' })
  readiness() {
    return this.diagnosticsService.readiness();
  }

  // TEMPORARY VM1 HOMOLOGATION ENDPOINT — REMOVE AFTER VALIDATION
  @Get('vm1-variant-attributes/dry-run')
  dryRunVariantAttributes() {
    return this.diagnosticsService.variantAttributesDryRun();
  }

  // TEMPORARY VM1 HOMOLOGATION ENDPOINT — REMOVE AFTER VALIDATION
  @Post('vm1-variant-attributes/apply')
  applyVariantAttributes() {
    return this.diagnosticsService.applyVariantAttributes();
  }

  // TEMPORARY VM1 HOMOLOGATION ENDPOINT — REMOVE AFTER VALIDATION
  @Get('vm1-variant-attributes/status')
  statusVariantAttributes() {
    return this.diagnosticsService.variantAttributesStatus();
  }
}
