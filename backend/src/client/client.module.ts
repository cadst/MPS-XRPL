import { Module } from '@nestjs/common';
import { CompanieModule } from './companies/companies.module';
import { AuthModule } from './auth/auth.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { MusicsModule } from './musics/musics.module';
import { ExploreModule } from './explore/explore.module';

@Module({
  imports: [CompanieModule, AuthModule, PlaylistsModule, MusicsModule, ExploreModule]
})
export class ClientModule {}
