// src/modules/companies/companies.controller.ts
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  Param, 
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { randomBytes } from 'node:crypto';
import * as fs from 'fs';

import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-companie.dto';

// ===== 업로드 저장 폴더 준비 (/uploads/profile) =====
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'profile');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  /**
   * 회원가입: multipart/form-data 지원
   * - 파일 필드명: profile_image
   * - 파일이 오면 /uploads/profile/<랜덤명> 으로 저장하고, dto.profile_image_url 세팅
   * - 파일이 없으면 dto.profile_image_url(문자열) 그대로 사용
   * - skipNts=1|true 쿼리로 NTS 스킵 제어 가능(개발/테스트용)
   */
  @Post('register')
  @UseInterceptors(
    FileInterceptor('profile_image', {
      storage: diskStorage({
        destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
        filename: (_req, file, cb) => {
          const id = randomBytes(16).toString('hex');
          cb(null, `${id}${extname(file.originalname || '')}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
      fileFilter: (_req, file, cb) => {
        // 이미지 MIME만 허용
        if (/^image\/(png|jpe?g|gif|webp|avif)$/.test(file.mimetype)) cb(null, true);
        else cb(new BadRequestException('이미지 파일만 업로드 가능합니다.') as any, false);
      },
    }),
  )
  async register(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: CreateCompanyDto,
    @Query('skipNts') skipNts?: string,
  ) {
    if (file) {
      // 정적 서빙은 /uploads 로 할 예정 -> 브라우저에서 바로 접근 가능
      (dto as any).profile_image_url = `/uploads/profile/${file.filename}`;
    }
    const shouldSkip = skipNts === '1' || skipNts === 'true';
    return this.companiesService.create(dto, shouldSkip);
  }

  /**
   * 사업자번호 검증 (버튼용)
   * - bNo: 하이픈 포함 가능 (서비스에서 정규화)
   * - skipNts=1|true 로 외부 확인 스킵 가능(테스트용)
   */
  @Get('business_numbers')
  verifyBusinessNumber(
    @Query('bNo') bNo: string,
    @Query('skipNts') skipNts?: string,
  ) {
    const shouldSkip = skipNts === '1' || skipNts === 'true';
    return this.companiesService.verifyBizno(bNo, shouldSkip);
  }

  @Post(':id/regenerate-api-key')
  async rotateById(@Param('id', ParseIntPipe) id: number) {
    // 응답: { api_key: string, last4: string }
    console.log("들어온다")
    return this.companiesService.regenerateApiKey(id);
  }

  /**
   * 스마트 계정 생성 또는 조회
   * - 회원가입 후 스마트 계정을 별도로 생성하고 싶은 경우
   * - 기존에 생성된 스마트 계정 주소를 조회하고 싶은 경우
   */
  @Post(':id/smart-account')
  async createOrGetSmartAccount(@Param('id', ParseIntPipe) id: number) {
    return this.companiesService.createOrGetSmartAccount(id);
  }
}
