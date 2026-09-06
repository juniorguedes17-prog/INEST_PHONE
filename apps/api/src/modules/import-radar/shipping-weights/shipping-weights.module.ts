import { Module } from '@nestjs/common';
import { PrismaModule } from '../../../prisma/prisma.module';
import { ManufacturersModule } from '../../manufacturers/manufacturers.module';
import { ShippingWeightRepository } from './shipping-weight.repository';
import { ShippingWeightRegistrationService } from './shipping-weight-registration.service';
import { ShippingWeightService } from './shipping-weight.service';

@Module({
  imports: [PrismaModule, ManufacturersModule],
  providers: [ShippingWeightRepository, ShippingWeightService, ShippingWeightRegistrationService],
  exports: [ShippingWeightService, ShippingWeightRegistrationService],
})
export class ShippingWeightsModule {}
