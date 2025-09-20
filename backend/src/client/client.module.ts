import { Module } from '@nestjs/common';
import { CompanieModule } from './companies/companies.module';
import { AuthModule } from './auth/auth.module';
import { PlaylistsModule } from './playlists/playlists.module';
import { MusicsModule } from './musics/musics.module';
import { ExploreModule } from './explore/explore.module';
import { TagsModule } from './tags/tags.module';
import { XrplService } from './xrpl/xrpl.service';
import { XrplController } from './xrpl/xrpl.controller';

@Module({
  imports: [
    CompanieModule,
    AuthModule,
    PlaylistsModule,
    MusicsModule,
    ExploreModule,
    TagsModule,
  ],
  controllers: [XrplController],
  providers: [XrplService],
})
export class ClientModule {}
