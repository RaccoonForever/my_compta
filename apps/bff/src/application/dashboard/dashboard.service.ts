import { Inject, Injectable } from '@nestjs/common';
import {
  AccountRepository,
  ACCOUNT_REPOSITORY,
} from '../ports/AccountRepository.js';
import { AccountDetailService } from '../accounts/account-detail.service.js';

export interface DashboardData {
  totalCash: number;
  baseCurrency: string;
  endOfMonthProjection: number;
  mtd: { income: number; expenses: number };
  accounts: Array<{ id: string; name: string; currency: string; balance: number; type: string; createdAt: string }>;
  forecast: ReturnType<import('@my-compta/domain').ForecastService['compute']>;
  categoryBreakdown: Array<{ categoryId: string | null; total: number }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
    private readonly accountDetailService: AccountDetailService,
  ) {}

  async getDashboard(userId: string, now: Date = new Date()): Promise<DashboardData> {
    const [accounts, accountDetails] = await Promise.all([
      this.accountRepo.findAllByUser(userId, false),
      this.getAccountDetailsForAllAccounts(userId, now),
    ]);

    // Aggregate data from all account details
    let totalCash = 0;
    let endOfMonthProjection = 0;
    let totalMtdIncome = 0;
    let totalMtdExpenses = 0;
    const categoryBreakdownMap = new Map<string | null, number>();
    const baseCurrency = accountDetails[0]?.baseCurrency ?? 'CHF';
    const emptyForecast: DashboardData['forecast'] = {
      points: [],
      markers: [],
      lowestPointDate: '',
      lowestBalance: 0,
    };
    let forecast: DashboardData['forecast'] = emptyForecast;

    accountDetails.forEach(detail => {
      if (detail) {
        totalCash += detail.currentBalance;
        endOfMonthProjection += detail.endOfMonthProjection;
        totalMtdIncome += detail.mtd.income;
        totalMtdExpenses += detail.mtd.expenses;

        // Aggregate category breakdown
        detail.categoryBreakdown.forEach(item => {
          const key = item.categoryId ?? null;
          categoryBreakdownMap.set(key, (categoryBreakdownMap.get(key) ?? 0) + item.total);
        });

        // Use first account's forecast (they all cover the same period)
        if (forecast.lowestBalance === 0) {
          forecast = detail.forecast;
        }
      }
    });

    const categoryBreakdown = Array.from(categoryBreakdownMap.entries()).map(([categoryId, total]) => ({
      categoryId,
      total,
    }));

    return {
      totalCash: Math.round(totalCash * 100) / 100,
      baseCurrency,
      endOfMonthProjection: Math.round(endOfMonthProjection * 100) / 100,
      mtd: {
        income: Math.round(totalMtdIncome * 100) / 100,
        expenses: Math.round(totalMtdExpenses * 100) / 100,
      },
      accounts: accounts.map(a => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
        balance: a.balance,
        type: a.type,
        createdAt: a.createdAt.toISOString(),
      })),
      forecast,
      categoryBreakdown,
    };
  }

  private async getAccountDetailsForAllAccounts(userId: string, now: Date) {
    const accounts = await this.accountRepo.findAllByUser(userId, false);
    return Promise.all(accounts.map(acc => this.accountDetailService.getAccountDetail(userId, acc.id, now)));
  }
}
