export class PlayMusicResponseDto {
    success: boolean;
    message: string;
    data?: {
        musicId: number;
        title: string;
        artist: string;
        duration: number;
        playSessionId: number;
    };
}

export class DownloadLyricResponseDto {
    success: boolean;
    message: string;
    data?: {
        musicId: number;
        title: string;
        filename: string;
        downloadCount: number;
    };
}

export class ApiErrorResponseDto {
    success: false;
    error: string;
    statusCode: number;
    timestamp: string;
}
