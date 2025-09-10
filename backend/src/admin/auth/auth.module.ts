import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [JwtModule.register({
    secret: process.env.JWT_SECRET, 
    signOptions: { expiresIn: '1h' },
  }), ConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

// 관련된 컨트롤러와 프로바이더(서비스)를 한데 묶어 애플리케이션의 구조를 구성
// ** 이 모듈을 통해서만 다른 파일들이 서로 연결되고, 의존성 주입이 가능해짐