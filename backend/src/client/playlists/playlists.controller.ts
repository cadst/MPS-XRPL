import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req ,UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlaylistService } from './playlists.service';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { RemoveTracksDto } from './dto/remove-tracks.dto';
import { UsePlaylistDto } from './dto/use-playlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
@ApiTags('playlists')
@UseGuards(JwtAuthGuard)
@Controller('playlist')
export class PlaylistsController {
  constructor(private readonly service: PlaylistService) {}

  @Post()
  create(@Req() req, @Body() dto: CreatePlaylistDto) {
    const companyId = Number(req.user?.sub);
    return this.service.create(companyId, dto);
  }
  /** GET /api/playlist : 내 플레이리스트 목록 */
  @Get()
  list(@Req() req) {
    const companyId = Number(req.user?.sub);
    return this.service.list(companyId);
  }

  /** GET /api/playlist/:id : 상세(메타) */
  @Get(':playlistId')
  detail(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    return this.service.detail(companyId, playlistId);
  }

  /** GET /api/playlist/:id/tracks : 상세 트랙(모달용 Track 배열) */
  @Get(':playlistId/tracks')
  tracks(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    return this.service.tracks(companyId, playlistId);
  }

  /** PUT /api/playlist/:id/tracks : 트랙 전체 교체 */
  @Put(':playlistId/tracks')
  replaceTracks(
    @Req() req,
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: UpdatePlaylistDto,
  ) {
    const companyId = Number(req.user?.sub);
    return this.service.replaceTracks(companyId, playlistId, dto.trackIds);
  }

  @Post(':playlistId/tracks:remove')
  removeTracks(
    @Req() req,
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: RemoveTracksDto,
  ) {
    const companyId = Number(req.user?.sub);
    return this.service.removeTracks(companyId, playlistId, dto.trackIds);
  }

  /** DELETE /api/playlist/:id : 플레이리스트 삭제 */
  @Delete(':playlistId')
  remove(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    return this.service.remove(companyId, playlistId);
  }

  /** POST /api/playlist/:id/use : 선택 사용(없으면 전곡) */
  @Post(':playlistId/use')
  use(
    @Req() req,
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: UsePlaylistDto,
  ) {
    const companyId = Number(req.user?.sub);
    return this.service.use(companyId, playlistId, dto);
  }
}
