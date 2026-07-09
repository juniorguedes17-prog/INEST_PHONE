import { BadRequestException } from '@nestjs/common';

export function ensureExists(record: unknown, message: string) {
  if (!record) {
    throw new BadRequestException(message);
  }
}
