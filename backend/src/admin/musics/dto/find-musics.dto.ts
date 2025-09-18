import { IsOptional, IsString, IsNumber, IsEnum, IsDateString, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

export enum SortField {
    TITLE = 'title',
    ARTIST = 'artist',
    GENRE = 'genre',
    MUSIC_TYPE = 'musicType',
    VALID_PLAYS = 'validPlays',
    VALID_RATE = 'validRate',
    REWARD = 'reward',
    CREATED_AT = 'createdAt',
    PLAYS = 'plays'
}

export enum SortOrder {
    ASC = 'asc',
    DESC = 'desc'
}

export class FindMusicsDto {
    @IsOptional()
    @Transform(({ value }) => value ? Number(value) : 1)
    @IsNumber()
    page?: number = 1;

    @IsOptional()
    @Transform(({ value }) => value ? Number(value) : 10)
    @IsNumber()
    limit?: number = 10;

    @IsOptional()
    @IsString()
    search?: string;

    @IsOptional()
    @IsString()
    category?: string;

    @IsOptional()
    @IsString()
    musicType?: string;

    @IsOptional()
    @IsString()
    idSortFilter?: '전체' | '오름차순' | '내림차순';

    @IsOptional()
    @IsString()
    releaseDateSortFilter?: '전체' | '오름차순' | '내림차순';

    @IsOptional()
    @IsString()
    rewardLimitFilter?: '전체' | '오름차순' | '내림차순';

    // @IsOptional()
    // @IsString()
    // validPlaysFilter?: '많은순' | '적은순';

    // @IsOptional()
    // @IsString()
    // validRateFilter?: '높은순' | '낮은순';

    // @IsOptional()
    // @IsString()
    // rewardFilter?: '높은순' | '낮은순' | '리워드 있음' | '리워드 없음';

    @IsOptional()
    @IsString()
    dateFilter?: '최신순' | '오래된순';

    @IsOptional()
    @IsEnum(SortField)
    sortBy?: SortField = SortField.CREATED_AT;

    @IsOptional()
    @IsEnum(SortOrder)
    sortOrder?: SortOrder = SortOrder.DESC;

    @IsOptional()
    @IsBoolean()
    includeStats?: boolean = false;

    @IsOptional()
    @IsString()
    statsType?: 'daily' | 'weekly' | 'monthly' | 'yearly';

    @IsOptional()
    @IsDateString()
    startDate?: string;

    @IsOptional()
    @IsDateString()
    endDate?: string;
}