import { IsArray, IsNumber, ArrayMinSize } from 'class-validator';

export class DeleteMusicsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  ids: number[];
} 