import { Module } from '@nestjs/common';
import { MusicController } from './music.controller';
import { LyricController } from './lyric.controller';
import { MusicService } from './music.service';
import { ApiKeyService } from './api-key.service';

@Module({
    controllers: [MusicController, LyricController],
    providers: [MusicService, ApiKeyService],
    exports: [MusicService, ApiKeyService],
})
export class MusicModule { }
