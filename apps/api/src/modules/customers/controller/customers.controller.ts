import { Controller, Get, Inject, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CustomersQueryDto } from '../dto/customers-query.dto';
import { CustomersService } from '../service/customers.service';

@ApiTags('Clientes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clientes diretamente da fonte Google Sheets.' })
  list(@Query() query: CustomersQueryDto) {
    return this.customersService.list(query);
  }

  @Post('sync')
  @ApiOperation({ summary: 'Sincroniza a fonte compartilhada de Clientes e Dashboard.' })
  sync() {
    return this.customersService.sync();
  }
}
