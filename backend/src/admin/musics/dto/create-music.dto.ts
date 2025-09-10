import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, Min, IsBoolean, MinLength } from 'class-validator';

export class CreateMusicDto {
    @IsString()
    @MinLength(1)
    title: string;

    @IsString()
    @MinLength(1)
    artist: string;

    @IsString()
    category: string;

    @IsEnum(['일반', 'Inst'])
    musicType: '일반' | 'Inst';

    @IsNumber()
    @Min(1)
    durationSec: number;

    @IsOptional()
    @IsString()
    tags?: string;

    @IsOptional()
    @IsDateString()
    releaseDate?: string;

    @IsOptional()
    @IsString()
    lyricist?: string;

    @IsOptional()
    @IsString()
    composer?: string;

    @IsOptional()
    @IsString()
    arranger?: string;

    @IsOptional()
    @IsString()
    isrc?: string;

    @IsNumber()
    @Min(0)
    priceMusicOnly: number;

    @IsNumber()
    @Min(0)
    priceLyricsOnly: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    priceRef?: number;

    @IsNumber()
    @Min(0)
    rewardPerPlay: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxPlayCount?: number;

    @IsOptional()
    @IsBoolean()
    hasRewards?: boolean;

    @IsEnum([0, 1, 2])
    grade: 0 | 1 | 2; 

    @IsOptional()
    @IsString()
    lyricsText?: string;

    @IsEnum(['file', 'text'])
    lyricsInputType: 'file' | 'text';

    @IsString()
    @MinLength(1)
    audioFilePath: string;

    @IsOptional()
    @IsString()
    coverImagePath?: string;

    @IsOptional()
    @IsString()
    lyricsFilePath?: string;
}
