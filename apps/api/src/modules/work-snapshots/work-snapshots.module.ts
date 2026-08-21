import { Module } from '@nestjs/common';
import { WorkSnapshotService } from './work-snapshot.service';

@Module({
  providers: [WorkSnapshotService],
  exports: [WorkSnapshotService],
})
export class WorkSnapshotsModule {}
