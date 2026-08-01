import { Body, Controller, Get, Inject, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import {
  CreateSupplierContactDto,
  SupplierContactQueryDto,
  UpdateSupplierContactDto,
} from '../dto/supplier-contact.dto';
import { SupplierContactsService } from '../service/supplier-contacts.service';

@ApiTags('Supplier contacts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('supplier-contacts')
export class SupplierContactsController {
  constructor(
    @Inject(SupplierContactsService)
    private readonly supplierContactsService: SupplierContactsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista contatos operacionais de fornecedores.' })
  list(@Query() query: SupplierContactQueryDto) {
    return this.supplierContactsService.list(query);
  }

  @Post()
  @ApiOperation({ summary: 'Cadastra contato operacional de fornecedor.' })
  create(@Body() dto: CreateSupplierContactDto) {
    return this.supplierContactsService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza contato operacional de fornecedor.' })
  update(@Param('id') id: string, @Body() dto: UpdateSupplierContactDto) {
    return this.supplierContactsService.update(id, dto);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Ativa contato operacional de fornecedor.' })
  activate(@Param('id') id: string) {
    return this.supplierContactsService.setActive(id, true);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desativa contato operacional de fornecedor.' })
  deactivate(@Param('id') id: string) {
    return this.supplierContactsService.setActive(id, false);
  }
}
