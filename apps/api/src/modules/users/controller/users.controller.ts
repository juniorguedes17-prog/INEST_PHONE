import { Body, Controller, Get, Inject, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateAdministratorDto } from '../dto/users.dto';
import { UsersService } from '../service/users.service';
import { ADMINISTRATOR_ROLE } from '../users.constants';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ADMINISTRATOR_ROLE)
@Controller('users')
export class UsersController {
  constructor(@Inject(UsersService) private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista usuarios com acesso administrativo.' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.list(user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Cria um usuario administrador.' })
  create(@Body() dto: CreateAdministratorDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.createAdministrator(dto, user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativa o acesso de um administrador.' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivateAdministrator(id, user);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Reativa o acesso de um administrador.' })
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.activateAdministrator(id, user);
  }
}
