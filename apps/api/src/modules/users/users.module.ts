import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { UsersController } from './controller/users.controller';
import { UsersRepository } from './repository/users.repository';
import { UsersService } from './service/users.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
})
export class UsersModule {}
