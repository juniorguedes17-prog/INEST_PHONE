import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ShippingWeightRepository } from './shipping-weight.repository';
import { ShippingWeightService } from './shipping-weight.service';

@Module({
  imports: [PrismaModule],
  providers: [ShippingWeightRepository, ShippingWeightService],
  exports: [ShippingWeightService],
})
export class ShippingWeightsModule {}
