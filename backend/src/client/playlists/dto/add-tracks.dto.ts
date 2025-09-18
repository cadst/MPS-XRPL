// dto/add-tracks.dto.ts
import { IsArray, ArrayNotEmpty, IsInt } from 'class-validator';

export class AddTracksDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  trackIds!: number[];
}