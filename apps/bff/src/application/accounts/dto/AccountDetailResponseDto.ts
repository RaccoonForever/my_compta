export class AccountDetailResponseDto {
  account!: {
    id: string;
    name: string;
    currency: string;
    balance: number;
    type: string;
    createdAt: string;
  };
  baseCurrency!: string;
  currentBalance!: number;
  endOfMonthProjection!: number;
  mtd!: {
    income: number;
    expenses: number;
  };
  forecast!: any;
  categoryBreakdown!: Array<{ categoryId: string | null; total: number }>;
  recentTransactions!: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    date: string;
    label: string;
    categoryId?: string;
  }>;

  static from(data: any): AccountDetailResponseDto {
    const dto = new AccountDetailResponseDto();
    Object.assign(dto, data);
    return dto;
  }
}
