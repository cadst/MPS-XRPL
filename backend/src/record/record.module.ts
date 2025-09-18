import { Module } from '@nestjs/common';
import { RecordController } from './record.controller';
import { RecordService } from './record.service';
import { DbModule } from '../db/db.module';

@Module({
    imports: [DbModule],
    controllers: [RecordController],
    providers: [RecordService],
    exports: [RecordService]
})
export class RecordModule { }
