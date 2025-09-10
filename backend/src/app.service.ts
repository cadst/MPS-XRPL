import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
    console.log('DATABASE_URL(at runtime)=', process.env.DATABASE_URL?.replace(/(:\/\/).*@/, '://****@'));
  }
}
