import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import { Account } from '@my-compta/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<{
  id: string;
  balance: number;
  currency: string;
  createdAt: Date;
}> = {}): Account {
  return Account.create({
    id: overrides.id ?? 'acc-1',
    userId: 'user-1',
    name: 'Test Account',
    type: 'bank',
    currency: (overrides.currency ?? 'CHF') as any,
    balance: overrides.balance ?? 1000,
    createdAt: overrides.createdAt,
  });
}

function makeAccountRepo(accounts: Account[] = []) {
  return { findAllByUser: vi.fn().mockResolvedValue(accounts) };
}

function makeAccountDetailService(accountDetailsMap: Map<string, any> = new Map()) {
  return {
    getAccountDetail: vi.fn(async (userId: string, accountId: string) => {
      return accountDetailsMap.get(accountId) ?? {
        account: { id: accountId, name: 'Test', currency: 'CHF', balance: 1000, type: 'bank', createdAt: new Date().toISOString() },
        baseCurrency: 'CHF',
        currentBalance: 1000,
        endOfMonthProjection: 1000,
        mtd: { income: 0, expenses: 0 },
        forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 },
        categoryBreakdown: [],
        recentTransactions: [],
      };
    }),
  };
}

const REF_NOW = new Date('2026-03-15T12:00:00.000Z');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardService (Refactored)', () => {
  it('aggregates currentBalance from all account details', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1', balance: 1000 }),
      makeAccount({ id: 'acc-2', balance: 500 }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1100, mtd: { income: 100, expenses: 50 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 600, endOfMonthProjection: 700, mtd: { income: 100, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 600 }, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.totalCash).toBe(1600); // 1000 + 600
  });

  it('aggregates MTD income and expenses from all accounts', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1' }),
      makeAccount({ id: 'acc-2' }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1000, mtd: { income: 500, expenses: 200 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 600, endOfMonthProjection: 700, mtd: { income: 300, expenses: 100 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 600 }, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.mtd.income).toBe(800); // 500 + 300
    expect(result.mtd.expenses).toBe(300); // 200 + 100
  });

  it('aggregates category breakdown from all accounts', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1' }),
      makeAccount({ id: 'acc-2' }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1000, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [{ categoryId: 'cat-1', total: 100 }, { categoryId: null, total: 50 }], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 600, endOfMonthProjection: 700, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 600 }, categoryBreakdown: [{ categoryId: 'cat-1', total: 200 }, { categoryId: 'cat-2', total: 75 }], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.categoryBreakdown).toHaveLength(3);
    expect(result.categoryBreakdown.find(c => c.categoryId === 'cat-1')?.total).toBe(300); // 100 + 200
    expect(result.categoryBreakdown.find(c => c.categoryId === 'cat-2')?.total).toBe(75);
    expect(result.categoryBreakdown.find(c => c.categoryId === null)?.total).toBe(50);
  });

  it('returns account list from account repository', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1', balance: 1000 }),
      makeAccount({ id: 'acc-2', balance: 500 }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1000, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 500, endOfMonthProjection: 500, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 500 }, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.accounts).toHaveLength(2);
    expect(result.accounts[0].id).toBe('acc-1');
    expect(result.accounts[1].id).toBe('acc-2');
  });

  it('aggregates endOfMonthProjection from all accounts', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1' }),
      makeAccount({ id: 'acc-2' }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1500, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 600, endOfMonthProjection: 900, mtd: { income: 0, expenses: 0 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 600 }, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.endOfMonthProjection).toBe(2400); // 1500 + 900
  });

  it('handles empty account list', async () => {
    const service = new DashboardService(
      makeAccountRepo([]) as any,
      makeAccountDetailService() as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.totalCash).toBe(0);
    expect(result.accounts).toHaveLength(0);
    expect(result.mtd.income).toBe(0);
    expect(result.mtd.expenses).toBe(0);
  });

  it('rounds aggregated monetary values to 2 decimals', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1' }),
      makeAccount({ id: 'acc-2' }),
    ];

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000.105, endOfMonthProjection: 1000.335, mtd: { income: 100.111, expenses: 50.555 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 }, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 600.205, endOfMonthProjection: 700.335, mtd: { income: 10.114, expenses: 0.444 }, forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 600 }, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.totalCash).toBe(1600.31);
    expect(result.endOfMonthProjection).toBe(1700.67);
    expect(result.mtd.income).toBe(110.23);
    expect(result.mtd.expenses).toBe(51);
  });

  it('falls back to CHF when no account detail exists', async () => {
    const accounts = [makeAccount({ id: 'acc-1' })];
    const detailService = {
      getAccountDetail: vi.fn().mockResolvedValue(undefined),
    };

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      detailService as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.baseCurrency).toBe('CHF');
    expect(result.totalCash).toBe(0);
    expect(result.endOfMonthProjection).toBe(0);
  });

  it('keeps first non-empty forecast when aggregating multiple accounts', async () => {
    const accounts = [
      makeAccount({ id: 'acc-1' }),
      makeAccount({ id: 'acc-2' }),
    ];

    const firstForecast = {
      points: [{ date: '2026-03-16', balance: 1200 }],
      markers: [],
      lowestPointDate: '2026-03-16',
      lowestBalance: 1200,
    };

    const secondForecast = {
      points: [{ date: '2026-03-16', balance: 900 }],
      markers: [],
      lowestPointDate: '2026-03-16',
      lowestBalance: 900,
    };

    const detailsMap = new Map([
      ['acc-1', { account: { id: 'acc-1' }, baseCurrency: 'CHF', currentBalance: 1000, endOfMonthProjection: 1100, mtd: { income: 0, expenses: 0 }, forecast: firstForecast, categoryBreakdown: [], recentTransactions: [] }],
      ['acc-2', { account: { id: 'acc-2' }, baseCurrency: 'CHF', currentBalance: 500, endOfMonthProjection: 550, mtd: { income: 0, expenses: 0 }, forecast: secondForecast, categoryBreakdown: [], recentTransactions: [] }],
    ]);

    const service = new DashboardService(
      makeAccountRepo(accounts) as any,
      makeAccountDetailService(detailsMap) as any,
    );

    const result = await service.getDashboard('user-1', REF_NOW);
    expect(result.forecast).toEqual(firstForecast);
  });
});
