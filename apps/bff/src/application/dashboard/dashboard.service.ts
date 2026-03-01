import { Inject, Injectable } from '@nestjs/common';
import { ForecastService, ForecastInput } from '@my-compta/domain';
import {
  AccountRepository,
  ACCOUNT_REPOSITORY,
} from '../ports/AccountRepository.js';
import {
  TransactionRepository,
  TRANSACTION_REPOSITORY,
} from '../ports/TransactionRepository.js';
import {
  RecurringRepository,
  RECURRING_REPOSITORY,
} from '../ports/RecurringRepository.js';
import { FIRESTORE } from '../../infrastructure/adapters/firestore/firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;
const forecaster = new ForecastService();

export interface DashboardData {
  totalCash: number;
  baseCurrency: string;
  endOfMonthProjection: number;
  mtd: { income: number; expenses: number };
  accounts: Array<{ id: string; name: string; currency: string; balance: number; type: string; createdAt: string }>;
  forecast: ReturnType<ForecastService['compute']>;
  categoryBreakdown: Array<{ categoryId: string | null; total: number }>;
}

@Injectable()
export class DashboardService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly txRepo: TransactionRepository,
    @Inject(RECURRING_REPOSITORY) private readonly recurringRepo: RecurringRepository,
    @Inject(FIRESTORE) private readonly db: Firestore,
  ) {}

  async getDashboard(userId: string, now: Date = new Date()): Promise<DashboardData> {
    const settingsDoc = await this.db.collection('settings').doc(userId).get();
    const baseCurrency: string = settingsDoc.exists
      ? (settingsDoc.data()!['baseCurrency'] as string) ?? 'CHF'
      : 'CHF';
    const fxRates: Record<string, number> = settingsDoc.exists
      ? (settingsDoc.data()!['fxRates'] as Record<string, number>) ?? {}
      : {};

    const mtdStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const eomDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    const [accounts, recurringTemplates, allTxsToEom] = await Promise.all([
      this.accountRepo.findAllByUser(userId, false),
      this.recurringRepo.findAllByUser(userId),
      // Fetch up to EOM — single query covers totalCash (≤ now) and EOM projection (≤ eomDate)
      this.txRepo.findByUser(userId, { to: eomDate }),
    ]);

    // Partition by time boundary
    const allTxsToNow = allTxsToEom.filter(t => t.date <= now);
    const mtdTxs = allTxsToNow.filter(t => t.date >= mtdStart);

    const mtdIncome = mtdTxs
      .filter(t => t.type === 'income')
      .reduce((s, t) => s + t.amount.value, 0);
    const mtdExpenses = mtdTxs
      .filter(t => t.type === 'expense')
      .reduce((s, t) => s + t.amount.value, 0);

    // Category breakdown (MTD expenses)
    const breakdown = new Map<string | null, number>();
    for (const tx of mtdTxs.filter(t => t.type === 'expense')) {
      const key = tx.categoryId ?? null;
      breakdown.set(key, (breakdown.get(key) ?? 0) + tx.amount.value);
    }
    const categoryBreakdown = [...breakdown.entries()].map(([categoryId, total]) => ({
      categoryId,
      total,
    }));

    // Total cash: opening balances of already-open accounts + all transactions up to now
    const activeAccounts = accounts.filter(a => a.createdAt <= now);
    const activeAccountIds = new Set(activeAccounts.map(a => a.id));

    const txDeltaByAccount = new Map<string, number>();
    for (const tx of allTxsToNow) {
      if (!activeAccountIds.has(tx.accountId)) continue;
      const delta = tx.type === 'income' ? tx.amount.value : -tx.amount.value;
      txDeltaByAccount.set(tx.accountId, (txDeltaByAccount.get(tx.accountId) ?? 0) + delta);
    }

    const totalCash = activeAccounts.reduce((sum, a) => {
      const effectiveBalance = a.balance + (txDeltaByAccount.get(a.id) ?? 0);
      const converted = a.currency === baseCurrency
        ? effectiveBalance
        : effectiveBalance * (fxRates[a.currency] ?? 1);
      return sum + converted;
    }, 0);

    // EOM projection: opening balances of accounts open by EOM + all transactions up to EOM
    const eomAccounts = accounts.filter(a => a.createdAt <= eomDate);
    const eomAccountIds = new Set(eomAccounts.map(a => a.id));

    const eomTxDeltaByAccount = new Map<string, number>();
    for (const tx of allTxsToEom) {
      if (!eomAccountIds.has(tx.accountId)) continue;
      if (tx.date > eomDate) continue; // defensive guard (repo already filters, but ensures test correctness)
      const delta = tx.type === 'income' ? tx.amount.value : -tx.amount.value;
      eomTxDeltaByAccount.set(tx.accountId, (eomTxDeltaByAccount.get(tx.accountId) ?? 0) + delta);
    }

    const endOfMonthProjection = eomAccounts.reduce((sum, a) => {
      const effectiveBalance = a.balance + (eomTxDeltaByAccount.get(a.id) ?? 0);
      const converted = a.currency === baseCurrency
        ? effectiveBalance
        : effectiveBalance * (fxRates[a.currency] ?? 1);
      return sum + converted;
    }, 0);

    // Forecast chart: next 90 days (used for chart rendering only)
    const forecastEnd = new Date(now);
    forecastEnd.setUTCDate(forecastEnd.getUTCDate() + 90);

    const forecastInput: ForecastInput = {
      accounts: accounts.map(a => a.toPrimitives()),
      recurringTemplates: recurringTemplates.map(r => r.toPrimitives()),
      futurePlannedTransactions: [],
      fxRates,
      baseCurrency,
    };
    const forecast = forecaster.compute(forecastInput, now, forecastEnd);

    return {
      totalCash: Math.round(totalCash * 100) / 100,
      baseCurrency,
      endOfMonthProjection: Math.round(endOfMonthProjection * 100) / 100,
      mtd: {
        income: Math.round(mtdIncome * 100) / 100,
        expenses: Math.round(mtdExpenses * 100) / 100,
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
}
