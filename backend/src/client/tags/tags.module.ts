import { Module } from '@nestjs/common';
import { TagsService } from './tags.service';
import { TagsController } from './tags.controller';
import { TagsCron } from './tags.cron';
@Module({
  controllers: [TagsController],
  providers: [TagsService, TagsCron],
})
export class TagsModule {}
