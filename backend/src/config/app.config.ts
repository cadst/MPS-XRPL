export const APP_CONFIG = {
  // 시간대 설정
  TIMEZONE: process.env.APP_TIMEZONE || 'Asia/Seoul',
  
  // 매출 분석 기본 설정
  REVENUE: {
    // 기본 시작 연도
    DEFAULT_START_YEAR: parseInt(process.env.REVENUE_DEFAULT_START_YEAR || '2024'),
    // 기본 조회 개월 수
    DEFAULT_MONTHS: parseInt(process.env.REVENUE_DEFAULT_MONTHS || '15'),
    // 최대 조회 개월 수
    MAX_MONTHS: parseInt(process.env.REVENUE_MAX_MONTHS || '24'),
    // 조회할 연도 범위
    YEARS: (process.env.REVENUE_YEARS || '2024,2025').split(',').map(Number),
  },
  
  // 구독료 설정
  SUBSCRIPTION: {
    PRICES: {
      STANDARD: parseInt(process.env.SUBSCRIPTION_PRICE_STANDARD || '500000'),
      BUSINESS: parseInt(process.env.SUBSCRIPTION_PRICE_BUSINESS || '1200000'),
      FREE: 0,
    },
    DISCOUNT_RANGES: {
      STANDARD: {
        MIN: parseFloat(process.env.SUBSCRIPTION_DISCOUNT_STANDARD_MIN || '0.08'),
        MAX: parseFloat(process.env.SUBSCRIPTION_DISCOUNT_STANDARD_MAX || '0.23'),
      },
      BUSINESS: {
        MIN: parseFloat(process.env.SUBSCRIPTION_DISCOUNT_BUSINESS_MIN || '0.10'),
        MAX: parseFloat(process.env.SUBSCRIPTION_DISCOUNT_BUSINESS_MAX || '0.30'),
      },
    },
  },
}
