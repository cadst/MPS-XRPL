import { Test, TestingModule } from '@nestjs/testing';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';
import { ApiKeyService } from './api-key.service.old';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('MusicController', () => {
    let controller: MusicController;
    let musicService: MusicService;

    const mockMusicService = {
        validateApiKey: jest.fn(),
        findById: jest.fn(),
        checkPlayPermission: jest.fn(),
        checkLyricPermission: jest.fn(),
        startPlaySession: jest.fn(),
        endPlaySession: jest.fn(),
        recordLyricDownload: jest.fn(),
    };

    const mockApiKeyService = {
        validateApiKey: jest.fn(),
        generateApiKey: jest.fn(),
        revokeApiKey: jest.fn(),
        isValidApiKeyFormat: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MusicController],
            providers: [
                {
                    provide: MusicService,
                    useValue: mockMusicService,
                },
                {
                    provide: ApiKeyService,
                    useValue: mockApiKeyService,
                },
                {
                    provide: 'DB',
                    useValue: {},
                },
            ],
        }).compile();

        controller = module.get<MusicController>(MusicController);
        musicService = module.get<MusicService>(MusicService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('playMusic', () => {
        it('should throw unauthorized error when API key is invalid', async () => {
            mockMusicService.validateApiKey.mockResolvedValue(null);

            const mockResponse = {
                setHeader: jest.fn(),
                status: jest.fn(),
                on: jest.fn(),
            } as any;

            await expect(
                controller.playMusic(1, 'invalid-key', 'test-agent', '', mockResponse),
            ).rejects.toThrow(new HttpException('유효하지 않은 API 키입니다.', HttpStatus.UNAUTHORIZED));
        });

        it('should throw not found error when music does not exist', async () => {
            const mockCompany = { id: 1, name: 'Test Company', grade: 'standard' };
            mockMusicService.validateApiKey.mockResolvedValue(mockCompany);
            mockMusicService.findById.mockResolvedValue(null);

            const mockResponse = {
                setHeader: jest.fn(),
                status: jest.fn(),
                on: jest.fn(),
            } as any;

            await expect(
                controller.playMusic(1, 'valid-key', 'test-agent', '', mockResponse),
            ).rejects.toThrow(new HttpException('음원을 찾을 수 없습니다.', HttpStatus.NOT_FOUND));
        });
    });

    describe('downloadLyric', () => {
        it('should throw not found error when lyric file does not exist', async () => {
            const mockCompany = { id: 1, name: 'Test Company', grade: 'standard' };
            const mockMusic = {
                id: 1,
                title: 'Test Music',
                is_active: true,
                lyrics_file_path: null
            };

            mockMusicService.validateApiKey.mockResolvedValue(mockCompany);
            mockMusicService.findById.mockResolvedValue(mockMusic);

            const mockResponse = {
                setHeader: jest.fn(),
                status: jest.fn(),
                on: jest.fn(),
            } as any;

            await expect(
                controller.downloadLyric(1, 'valid-key', 'test-agent', mockResponse),
            ).rejects.toThrow(new HttpException('가사 파일이 없습니다.', HttpStatus.NOT_FOUND));
        });
    });
});
