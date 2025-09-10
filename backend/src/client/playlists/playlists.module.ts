import { Module } from '@nestjs/common';
import { PlaylistService } from './playlists.service';
import { PlaylistsController } from './playlists.controller';

@Module({
  controllers: [PlaylistsController],
  providers: [PlaylistService],
})
export class PlaylistsModule {}
