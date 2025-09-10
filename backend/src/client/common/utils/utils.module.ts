import { Module } from '@nestjs/common';
import { ApiKeyUtil } from './api-key.util';

@Module({
  providers: [ApiKeyUtil],
  exports: [ApiKeyUtil],
})
export class UtilsModule {}
