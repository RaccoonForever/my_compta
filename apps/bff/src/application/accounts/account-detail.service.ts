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

export interface AccountDetailData {
  account: { id: string; name: string; currency: string; balance: number; type: string; createdAt: string };
  baseCurrency: string;
  currentBalance: number;
  endOfMonthProjection: number;
  mtd: { income: number; expenses: number };
  forecast: ReturnType<ForecastService['compute']>;
  categoryBreakdown: Array<{ categoryId: string | null; total: number }>;
  recentTransactions: Array<{ id: string; type: string; amount: number; currency: string; date: string; label: string; categoryId?: string }>;
}

@Injectable()
export class AccountDetailService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
    @Inject(TRANSACTION_REPOSITORY) private readonly txRepo: TransactionRepository,
    @Inject(RECURRING_REPOSITORY) private readonly recurringRepo: RecurringRepository,
    @Inject(FIRESTORE) private readonly db: Firestore,
  ) {}

  async getAccountDetail(userId: string, accountId: string, now: Date = new Date()): Promise<AccountDetailData> {
    const [account, recurringTemplates] = await Promise.all([
      this.accountRepo.findById(userId, accountId),
      this.recurringRepo.findAllByUser(userId),
    ]);

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    const settingsDoc = await this.db.collection('settings').doc(userId).get();
    const baseCurrency: string = settingsDoc.exists
      ? (settingsDoc.data()!['baseCurrency'] as string) ?? 'CHF'
      : 'CHF';
    const fxRates: Record<string, number> = settingsDoc.exists
      ? (settingsDoc.data()!['fxRates'] as Record<string, number>) ?? {}
      : {};

    const mtdStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const eomDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

    // Fetch transactions for this account up to end of month + recent transactions
    const [allTxsToEom, recentTxs] = await Promise.all([
      this.txRepo.findByUser(userId, { accountId, to: eomDate }),
      this.txRepo.findByUser(userId, { accountId, limit: 10 }),
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

    // Category breakdown (MTD expenses only)
    const breakdown = new Map<string | null, number>();
    for (const tx of mtdTxs.filter(t => t.type === 'expense')) {
      const key = tx.categoryId ?? null;
      breakdown.set(key, (breakdown.get(key) ?? 0) + tx.amount.value);
    }
    const categoryBreakdown = [...breakdown.entries()].map(([categoryId, total]) => ({
      categoryId,
      total,
    }));

    // Current balance: opening balance + realized transactions up to now
    const txDeltaFromNow = allTxsToNow.reduce((sum, tx) => {
      const delta = tx.type === 'income' ? tx.amount.value : -tx.amount.value;
      return sum + delta;
    }, 0);

    const currentBalanceInAccountCurrency = account.balance + txDeltaFromNow;

    const currentBalance = account.currency === baseCurrency
      ? currentBalanceInAccountCurrency
      : currentBalanceInAccountCurrency * (fxRates[account.currency] ?? 1);

    // EOM projection
    const eomTxDelta = allTxsToEom.reduce((sum, tx) => {
      if (tx.date > eomDate) return sum;
      const delta = tx.type === 'income' ? tx.amount.value : -tx.amount.value;
      return sum + delta;
    }, 0);

    const endOfMonthProjectionInAccountCurrency = account.balance + eomTxDelta;
    const endOfMonthProjection = account.currency === baseCurrency
      ? endOfMonthProjectionInAccountCurrency
      : endOfMonthProjectionInAccountCurrency * (fxRates[account.currency] ?? 1);

    // Forecast for next 90 days
    const forecastEnd = new Date(now);
    forecastEnd.setUTCDate(forecastEnd.getUTCDate() + 90);

    const forecastInput: ForecastInput = {
      accounts: [account.toPrimitives()],
      recurringTemplates: recurringTemplates.map(r => r.toPrimitives()),
      futurePlannedTransactions: [],
      fxRates,
      baseCurrency,
    };
    const forecast = forecaster.compute(forecastInput, now, forecastEnd);

    return {
      account: {
        id: account.id,
        name: account.name,
        currency: account.currency,
        balance: account.balance,
        type: account.type,
        createdAt: account.createdAt.toISOString(),
      },
      baseCurrency,
      currentBalance: Math.round(currentBalance * 100) / 100,
      endOfMonthProjection: Math.round(endOfMonthProjection * 100) / 100,
      mtd: {
        income: Math.round(mtdIncome * 100) / 100,
        expenses: Math.round(mtdExpenses * 100) / 100,
      },
      forecast,
      categoryBreakdown,
      recentTransactions: recentTxs.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount.value,
        currency: tx.amount.currency,
        date: tx.date.toISOString(),
        label: tx.label,
        ...(tx.categoryId !== undefined ? { categoryId: tx.categoryId } : {}),
      })),
    };
  }
}
