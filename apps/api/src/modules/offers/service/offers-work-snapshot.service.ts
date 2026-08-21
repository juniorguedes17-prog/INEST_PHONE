import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  WORK_SNAPSHOT_SCOPES,
  WorkSnapshotService,
} from '../../work-snapshots/work-snapshot.service';
import { ReplaceOffersWorkSnapshotDto } from '../dto/offers.dto';

type OffersWorkSnapshot = {
  drafts: ReplaceOffersWorkSnapshotDto['drafts'];
  failedCount: number;
};

@Injectable()
export class OffersWorkSnapshotService {
  constructor(private readonly workSnapshots: WorkSnapshotService) {}

  get(user: AuthenticatedUser) {
    return this.workSnapshots.get<OffersWorkSnapshot>(user.id, WORK_SNAPSHOT_SCOPES.OFFERS_PRICING);
  }

  async replace(dto: ReplaceOffersWorkSnapshotDto, user: AuthenticatedUser) {
    if (!dto.drafts.length) {
      throw new BadRequestException('Nenhum rascunho válido foi preparado para Ofertas.');
    }

    const payload: OffersWorkSnapshot = {
      drafts: dto.drafts,
      failedCount: dto.failedCount,
    };
    await this.workSnapshots.replace(
      user.id,
      WORK_SNAPSHOT_SCOPES.OFFERS_PRICING,
      payload as unknown as Prisma.InputJsonValue,
    );

    return payload;
  }
}
