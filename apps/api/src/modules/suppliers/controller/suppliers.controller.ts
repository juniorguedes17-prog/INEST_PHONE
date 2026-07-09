import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from '../dto/supplier.dto';
import { SuppliersService } from '../service/suppliers.service';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('suppliers')
export class SuppliersController {
  constructor(@Inject(SuppliersService) private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista fornecedores cadastrados.' })
  list(@Query() query: SupplierQueryDto) {
    return this.suppliersService.list(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Busca detalhes de um fornecedor.' })
  findOne(@Param('id') id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra fornecedor.' })
  create(@Body() dto: CreateSupplierDto, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.create(dto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza fornecedor.' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.suppliersService.update(id, dto, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove fornecedor usando soft delete.' })
  softDelete(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.softDelete(id, user);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Ativa fornecedor.' })
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.activate(id, user);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativa fornecedor.' })
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.deactivate(id, user);
  }
}
