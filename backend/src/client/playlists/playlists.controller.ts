import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Req ,UseGuards, Logger } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlaylistService } from './playlists.service';
import { UpdatePlaylistDto } from './dto/update-playlist.dto';
import { RemoveTracksDto } from './dto/remove-tracks.dto';
import { UsePlaylistDto } from './dto/use-playlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddTracksDto } from './dto/add-tracks.dto';
@ApiTags('playlists')
@UseGuards(JwtAuthGuard)
@Controller('playlist')
export class PlaylistsController {
  private readonly logger = new Logger(PlaylistsController.name);
  constructor(private readonly service: PlaylistService) {}

  @Post()
  create(@Req() req, @Body() dto: CreatePlaylistDto) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[create] companyId=${companyId} dto=${JSON.stringify(dto)}`);
    return this.service.create(companyId, dto);
  }

  @Get()
  list(@Req() req) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[list] companyId=${companyId}`);
    return this.service.list(companyId);
  }

  @Get(':playlistId')
  detail(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[detail] companyId=${companyId} playlistId=${playlistId}`);
    return this.service.detail(companyId, playlistId);
  }

  @Get(':playlistId/tracks')
  tracks(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[tracks] companyId=${companyId} playlistId=${playlistId}`);
    return this.service.tracks(companyId, playlistId);
  }

  @Put(':playlistId/tracks')
  replaceTracks(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number, @Body() dto: UpdatePlaylistDto) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[replace] companyId=${companyId} playlistId=${playlistId} trackIds=${JSON.stringify(dto?.trackIds)}`);
    return this.service.replaceTracks(companyId, playlistId, dto.trackIds);
  }
  
  @Post(':playlistId/tracks')
  addTracks(
    @Req() req,
    @Param('playlistId', ParseIntPipe) playlistId: number,
    @Body() dto: AddTracksDto,
  ) {
    const companyId = Number(req.user?.sub);
    console.log('[PlaylistsController] addTracks IN', { companyId, playlistId, dto });
    return this.service.addTracks(companyId, playlistId, dto.trackIds);
  }

  @Post(':playlistId/tracks/remove')
  removeTracks(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number, @Body() dto: RemoveTracksDto) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[remove] companyId=${companyId} playlistId=${playlistId} trackIds=${JSON.stringify(dto?.trackIds)}`);
    return this.service.removeTracks(companyId, playlistId, dto.trackIds);
  }

  @Delete(':playlistId')
  remove(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[delete] companyId=${companyId} playlistId=${playlistId}`);
    return this.service.remove(companyId, playlistId);
  }

  @Post(':playlistId/use')
  use(@Req() req, @Param('playlistId', ParseIntPipe) playlistId: number, @Body() dto: UsePlaylistDto) {
    const companyId = Number(req.user?.sub);
    this.logger.log(`[use] companyId=${companyId} playlistId=${playlistId} trackIds=${JSON.stringify(dto?.trackIds)} useCase=${dto?.useCase}`);
    return this.service.use(companyId, playlistId, dto);
  }
}
