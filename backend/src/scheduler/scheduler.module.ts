import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { RecordModule } from '../record/record.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),
        RecordModule
    ],
    controllers: [SchedulerController],
    providers: [SchedulerService],
    exports: [SchedulerService]
})
export class SchedulerModule { }
