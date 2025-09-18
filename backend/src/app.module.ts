import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { JwtModule } from '@nestjs/jwt';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import biznoConfig from '../bizno.config';

import { AppController } from './app.controller';
import { AppService } from './app.service';
// import { AdminModule } from './admin/admin.module';
import { DashboardModule } from './admin/dashboard/dashboard.module';
import { ClientModule } from './client/client.module';
import { MeModule } from './client/me/me.module';
import { DbModule } from './db/db.module';
import { ExploreModule } from './client/explore/explore.module';
import { AdminModule } from './admin/admin.module';
import { TagsModule } from './client/tags/tags.module';

import { MusicModule } from './music/music.module';
import { RecordModule } from './record/record.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { TestModule } from './test/test.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(process.cwd(), 'apps/backend/.env'),
        join(__dirname, '../../.env'),
        '.env',
      ],
      load: [biznoConfig],
    }),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),

    // JWT를 전역으로 사용(ExploreController에서 JwtService 주입)
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET!,
      signOptions: { expiresIn: '30d' },
    }),

    ScheduleModule.forRoot({
      timezone: 'Asia/Seoul',
    } as any),

    AdminModule,
    DashboardModule,
    ClientModule,
    MeModule,
    DbModule,
    ExploreModule,
    MusicModule,
    RecordModule,
    SchedulerModule,
    TestModule,
    TagsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
