export type Purchase = {
    id: number;
    tier: 'standard' | 'business';
    paidAt: string;        // ISO date
    amount: number;
    method: string;
    maskedCard: string;
  };
  
  export type MileageLog = {
    id: number;
    subscriptionId: number;
    delta: number;
    reason: string;
    createdAt: string;
  };
  
  export type HistoryResponse = {
    purchases: Purchase[];
    mileageLogs: MileageLog[];
  };