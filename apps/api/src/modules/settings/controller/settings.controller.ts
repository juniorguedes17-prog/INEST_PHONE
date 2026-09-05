import { Body, Controller, Get, Inject, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Permissions } from '../../auth/decorators/permissions.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ResetSettingsDto, UpdateSettingsDto } from '../dto/settings.dto';
import { SettingsService } from '../service/settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(@Inject(SettingsService) private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'Busca as configuracoes globais do sistema.' })
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Patch()
  @UseGuards(PermissionsGuard)
  @Permissions('settings:configure')
  @ApiOperation({ summary: 'Atualiza as configuracoes globais do sistema.' })
  updateSettings(
    @Body() updateSettingsDto: UpdateSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.settingsService.updateSettings(updateSettingsDto, user);
  }

  @Post('reset-defaults')
  @UseGuards(PermissionsGuard)
  @Permissions('settings:configure')
  @ApiOperation({ summary: 'Restaura os valores padrao das configuracoes.' })
  resetDefaults(@Body() dto: ResetSettingsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.resetDefaults(user, dto?.target);
  }
}
