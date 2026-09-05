import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  WORK_SNAPSHOT_SCOPES,
  WorkSnapshotService,
} from '../../work-snapshots/work-snapshot.service';
import { ReplaceBrazilRadarWorkSnapshotDto } from '../dto/pricing.dto';
import { PricingService } from './pricing.service';

type BrazilRadarPricingWorkSnapshot = {
  items: unknown[];
  failedCount: number;
};

@Injectable()
export class PricingWorkSnapshotService {
  constructor(
    private readonly pricingService: PricingService,
    private readonly workSnapshots: WorkSnapshotService,
  ) {}

  get(user: AuthenticatedUser) {
    return this.workSnapshots.get<BrazilRadarPricingWorkSnapshot>(
      user.id,
      WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR,
    );
  }

  async replaceFromRadar(dto: ReplaceBrazilRadarWorkSnapshotDto, user: AuthenticatedUser) {
    const sourceQuoteIds = [...new Set(dto.sourceQuoteIds)];
    const calculations = await Promise.allSettled(
      sourceQuoteIds.map((sourceQuoteId) =>
        this.pricingService.calculateBrazilRadarQuote({ sourceQuoteId }),
      ),
    );
    const items = calculations.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failures = calculations.filter((result) => result.status === 'rejected');

    if (!items.length) {
      const firstFailure = failures[0];
      throw new BadRequestException(
        firstFailure?.status === 'rejected' && firstFailure.reason instanceof Error
          ? firstFailure.reason.message
          : 'Nenhuma cotação pôde ser enviada para Precificação.',
      );
    }

    const payload = { items, failedCount: failures.length };
    await this.workSnapshots.replace(
      user.id,
      WORK_SNAPSHOT_SCOPES.PRICING_BRAZIL_RADAR,
      payload as unknown as Prisma.InputJsonValue,
    );

    return payload;
  }
}
