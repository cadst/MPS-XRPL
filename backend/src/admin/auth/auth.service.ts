import { Injectable, UnauthorizedException } from '@nestjs/common'; // 클래스를 의존성 주입 가능한 프로바이더로 만들어주는 데코레이터
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';

@Injectable() 
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService, // 환경변수 읽어오는 서비스
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { adminId, adminPw } = loginDto;
    const Id = this.configService.get('ADMIN_ID');
    const Pw = this.configService.get('ADMIN_PW');

    if (adminId !== Id || adminPw !== Pw) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // JWT 토큰 생성
    const payload = { adminId };
    const accessToken = this.jwtService.sign(payload, {expiresIn: '1h'});
    const refreshToken = this.jwtService.sign(payload, {expiresIn: '7d'});

    return { accessToken, refreshToken, adminId };
  }

  async logout(authHeader: string): Promise<{ message: string }> {
    // 헤더 검증
    if (!authHeader) {
      throw new UnauthorizedException('유효하지 않은 인증 헤더입니다.');
    }
  
    const token = authHeader.split(' ')[1];
    
    try {
      // 토큰 검증
      await this.jwtService.verifyAsync(token);
      
      // 성공 응답
      return { message: '로그아웃 완료' };
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
  }

  async refreshToken(authHeader: string): Promise<LoginResponseDto> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('유효하지 않은 인증 헤더입니다.');
    }
  
    const refreshToken = authHeader.split(' ')[1];
    
    try {
      // refreshToken 검증
      const payload = await this.jwtService.verifyAsync(refreshToken);
      
      // 새로운 토큰 생성
      const newPayload = { sub: 'admin', adminId: payload.adminId, role: 'admin' };
      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '1h' });
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });
  
      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        adminId: payload.adminId,
      };
    } catch (error) {
      throw new UnauthorizedException('유효하지 않은 refresh token입니다.');
    }
  }
}

// 실제 비즈니스 로직을 담고있는 프로바이더. 컨트롤러에서 요청을 받아 처리하고 결과를 반환
// 프로바이더는 의존성주입을 통해 필요한 곳에 제공될 수 있는 모든 것
// 데이터베이스 연동, 비즈니스 로직, 외부 API 호출, 유효성 검사, 로깅, 트랜잭션 관리 등87956rt4SZgfhtfyiujyh8