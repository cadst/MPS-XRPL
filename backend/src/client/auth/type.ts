export type Tokens = { accessToken: string; refreshToken: string };

export type JwtPayload = {
  sub: number;
  grade: 'free' | 'standard' | 'business';
  subscriptionStatus: 'active' | 'canceled' | 'will_upgrade' | null;
  iat?: number; exp?: number;
};