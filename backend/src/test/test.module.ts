import { Module } from '@nestjs/common';
import { TestController } from './test.controller';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { RecordModule } from '../record/record.module';

@Module({
    imports: [SchedulerModule, RecordModule],
    controllers: [TestController],
})
export class TestModule { }
