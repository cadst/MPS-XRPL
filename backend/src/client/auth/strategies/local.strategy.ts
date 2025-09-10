// import { Strategy as LocalStrategyBase } from 'passport-local';
// import { PassportStrategy } from '@nestjs/passport';
// import { Injectable, UnauthorizedException  } from '@nestjs/common';
// import { AuthService } from '../auth.service';
// import type { CompanyRow } from '../../companies/companies.repository';

// @Injectable()
// export class LocalStrategy extends PassportStrategy(LocalStrategyBase, 'local') {
//   constructor(private readonly auth: AuthService) {
//     super({ usernameField: 'email', passwordField: 'password', session: false });
//   }

//   async validate(email: string, password: string): Promise<CompanyRow> {
//     const company = await this.auth.validate(email, password); // CompanyRow | null
//     if (!company) throw new UnauthorizedException('Invalid credentials');
//     return company; 
//   }
// }