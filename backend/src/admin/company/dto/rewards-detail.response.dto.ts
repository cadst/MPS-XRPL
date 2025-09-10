export class RewardsDetailDailyDto {
    date: string
    earned: number
    used: number
}

export class RewardsDetailByMusicDto {
    musicId: number
    title: string
    artist: string
    category: string | null
    validPlays: number
    earned: number
}

export class RewardsDetailSummaryDto {
    totalTokens: number
    monthlyEarned: number
    monthlyUsed: number
    usageRate: number
    activeTracks: number
    yearMonth: string
}

export class RewardsDetailCompanyDto {
    id: number
    name: string
    tier: 'free' | 'standard' | 'business'
}

export class RewardsDetailResponseDto {
    company: RewardsDetailCompanyDto
    summary: RewardsDetailSummaryDto
    daily: RewardsDetailDailyDto[]
    byMusic: RewardsDetailByMusicDto[]
}