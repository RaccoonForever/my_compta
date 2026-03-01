import { Inject, Injectable } from '@nestjs/common';
import {
  TransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../ports/TransactionRepository.js';

export interface YearlyEarningsResult {
  year: number;
  totalIncome: number;
  totalExpenses: number;
  monthly: Array<{ month: number; income: number; expenses: number }>;
}

export interface CategoryExpensesResult {
  categoryId: string | null;
  total: number;
  monthlyBreakdown: Array<{ month: number; total: number }>;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly txRepo: TransactionRepository,
  ) {}

  async getYearlyEarnings(userId: string, year: number): Promise<YearlyEarningsResult> {
    const from = new Date(Date.UTC(year, 0, 1));
    const to = new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const txs = await this.txRepo.findByUser(userId, { from, to });
    const nonTransfers = txs.filter(t => t.type !== 'transfer');

    let totalIncome = 0;
    let totalExpenses = 0;
    const monthly: Array<{ month: number; income: number; expenses: number }> = Array.from(
      { length: 12 },
      (_, i) => ({ month: i + 1, income: 0, expenses: 0 }),
    );

    for (const tx of nonTransfers) {
      const month = tx.date.getUTCMonth(); // 0-indexed
      if (tx.type === 'income') {
        totalIncome += tx.amount.value;
        monthly[month]!.income += tx.amount.value;
      } else {
        totalExpenses += tx.amount.value;
        monthly[month]!.expenses += tx.amount.value;
      }
    }

    return {
      year,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      monthly: monthly.map(m => ({
        month: m.month,
        income: Math.round(m.income * 100) / 100,
        expenses: Math.round(m.expenses * 100) / 100,
      })),
    };
  }

  async getCategoryExpenses(
    userId: string,
    year: number,
    month?: number,
  ): Promise<CategoryExpensesResult[]> {
    const from = month
      ? new Date(Date.UTC(year, month - 1, 1))
      : new Date(Date.UTC(year, 0, 1));
    const to = month
      ? new Date(Date.UTC(year, month - 1 + 1, 0, 23, 59, 59))
      : new Date(Date.UTC(year, 11, 31, 23, 59, 59));

    const txs = await this.txRepo.findByUser(userId, { from, to, type: 'expense' });

    // Group by categoryId
    const byCat = new Map<string | null, number[]>();
    for (const tx of txs) {
      const key = tx.categoryId ?? null;
      if (!byCat.has(key)) byCat.set(key, new Array(12).fill(0));
      byCat.get(key)![tx.date.getUTCMonth()] += tx.amount.value;
    }

    return [...byCat.entries()].map(([categoryId, months]) => ({
      categoryId,
      total: Math.round(months.reduce((s, v) => s + v, 0) * 100) / 100,
      monthlyBreakdown: months.map((total, i) => ({
        month: i + 1,
        total: Math.round(total * 100) / 100,
      })),
    }));
  }

  async getNetCashflow(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<Array<{ month: string; income: number; expenses: number; net: number }>> {
    const txs = await this.txRepo.findByUser(userId, { from, to });
    const byMonth = new Map<string, { income: number; expenses: number }>();

    for (const tx of txs.filter(t => t.type !== 'transfer')) {
      const key = `${tx.date.getUTCFullYear()}-${String(tx.date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!byMonth.has(key)) byMonth.set(key, { income: 0, expenses: 0 });
      if (tx.type === 'income') byMonth.get(key)!.income += tx.amount.value;
      else byMonth.get(key)!.expenses += tx.amount.value;
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, { income, expenses }]) => ({
        month,
        income: Math.round(income * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        net: Math.round((income - expenses) * 100) / 100,
      }));
  }
}
