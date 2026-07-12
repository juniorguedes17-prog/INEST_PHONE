import { Module } from '@nestjs/common';
import { IntegrationsModule } from '../integrations/integrations.module';
import { CustomersController } from './controller/customers.controller';
import { CustomersService } from './service/customers.service';

@Module({
  imports: [IntegrationsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
