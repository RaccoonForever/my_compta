import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service.js';
import { Account, Money } from '@my-compta/domain';

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

function makeFirestoreMock(baseCurrency = 'CHF', fxRates: Record<string, number> = {}) {
  const settingsData = { baseCurrency, fxRates };
  const settingsDoc = {
    exists: true,
    data: () => settingsData,
  };

  return {
    collection: vi.fn().mockReturnValue({
      doc: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue(settingsDoc),
      }),
    }),
  };
}

function makeAccountRepo(accounts: Account[] = []) {
  return { findAllByUser: vi.fn().mockResolvedValue(accounts) };
}

function makeTxRepo(txs: any[] = []) {
  return { findByUser: vi.fn().mockResolvedValue(txs) };
}

function makeRecurringRepo() {
  return { findAllByUser: vi.fn().mockResolvedValue([]) };
}

// Fixed reference date used across all tests — avoids any dependency on system clock
const REF_NOW = new Date('2026-03-15T12:00:00.000Z'); // mid-month for good MTD coverage
const REF_MTD_START = new Date('2026-03-01T00:00:00.000Z');
const REF_EOM = new Date('2026-03-31T23:59:59.999Z');
// Dates relative to REF_NOW
const PAST_DATE    = new Date('2026-03-10T00:00:00.000Z'); // before REF_NOW, within MTD
const LAST_MONTH   = new Date('2026-02-10T00:00:00.000Z'); // before MTD start
const FUTURE_WITHIN_MONTH = new Date('2026-03-25T00:00:00.000Z'); // after REF_NOW, before EOM
const FIRST_DAY_NEXT_MONTH = new Date('2026-04-01T00:00:00.000Z'); // after EOM

// Additional dates for edge case tests
const MARCH_1_2026 = new Date('2026-03-01T00:00:00.000Z');
const MARCH_20_2026 = new Date('2026-03-20T00:00:00.000Z');
const APRIL_1_2026 = new Date('2026-04-01T00:00:00.000Z');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  describe('getDashboard - totalCash', () => {
    it('sums balances of all accounts in base currency', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000, currency: 'CHF' }),
        makeAccount({ id: 'acc-2', balance: 500, currency: 'CHF' }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.totalCash).toBe(1500);
    });

    it('converts foreign currency accounts using fxRates', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000, currency: 'CHF' }),
        makeAccount({ id: 'acc-2', balance: 100, currency: 'EUR' }),
      ];

      // 1 EUR = 1.05 CHF
      const service = new DashboardService(
        makeAccountRepo(accounts) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock('CHF', { EUR: 1.05 }) as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.totalCash).toBeCloseTo(1000 + 100 * 1.05, 2);
    });

    it('uses rate of 1 for unknown currencies', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 500, currency: 'GBP' }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock('CHF', {}) as any, // no GBP rate
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.totalCash).toBe(500); // 500 * 1
    });

    it('excludes accounts that open in the future from totalCash', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000 }),
        makeAccount({ id: 'acc-2', balance: 500, createdAt: FUTURE_WITHIN_MONTH }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.totalCash).toBe(1000); // acc-2 not yet open, excluded from current cash
    });

    it('defaults baseCurrency to CHF when settings doc missing', async () => {
      const accounts = [makeAccount({ balance: 200 })];
      const db = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false, data: () => null }),
          }),
        }),
      };

      const service = new DashboardService(
        makeAccountRepo(accounts) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        db as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.baseCurrency).toBe('CHF');
      expect(result.totalCash).toBe(200);
    });
  });

  describe('getDashboard - MTD income and expenses', () => {
    it('only counts transactions from this month', async () => {
      const txRepo = makeTxRepo();

      // Repo returns all transactions up to EOM; service filters MTD in-memory
      txRepo.findByUser.mockResolvedValue([
        { type: 'income',  amount: { value: 500, currency: 'CHF' }, categoryId: null,    date: PAST_DATE,  accountId: 'acc-1' },
        { type: 'expense', amount: { value: 200, currency: 'CHF' }, categoryId: 'cat-1', date: PAST_DATE,  accountId: 'acc-1' },
        { type: 'income',  amount: { value: 999, currency: 'CHF' }, categoryId: null,    date: LAST_MONTH, accountId: 'acc-1' }, // last month — excluded from MTD
      ]);

      const service = new DashboardService(
        makeAccountRepo([makeAccount()]) as any,
        txRepo as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.mtd.income).toBe(500);
      expect(result.mtd.expenses).toBe(200);
    });

    it('returns 0 income and expenses when no transactions', async () => {
      const service = new DashboardService(
        makeAccountRepo([makeAccount()]) as any,
        makeTxRepo([]) as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.mtd.income).toBe(0);
      expect(result.mtd.expenses).toBe(0);
    });
  });

  describe('getDashboard - category breakdown', () => {
    it('groups expenses by categoryId', async () => {
      const txRepo = makeTxRepo();
      txRepo.findByUser.mockResolvedValue([
        { type: 'expense', amount: { value: 100, currency: 'CHF' }, categoryId: 'cat-food',      date: PAST_DATE, accountId: 'acc-1' },
        { type: 'expense', amount: { value: 50,  currency: 'CHF' }, categoryId: 'cat-food',      date: PAST_DATE, accountId: 'acc-1' },
        { type: 'expense', amount: { value: 80,  currency: 'CHF' }, categoryId: 'cat-transport', date: PAST_DATE, accountId: 'acc-1' },
        { type: 'income',  amount: { value: 500, currency: 'CHF' }, categoryId: 'cat-salary',    date: PAST_DATE, accountId: 'acc-1' }, // should be ignored
      ]);

      const service = new DashboardService(
        makeAccountRepo([makeAccount()]) as any,
        txRepo as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      const food = result.categoryBreakdown.find(c => c.categoryId === 'cat-food');
      const transport = result.categoryBreakdown.find(c => c.categoryId === 'cat-transport');
      const salary = result.categoryBreakdown.find(c => c.categoryId === 'cat-salary');

      expect(food?.total).toBe(150);
      expect(transport?.total).toBe(80);
      expect(salary).toBeUndefined(); // income not included
    });

    it('groups uncategorized expenses under null key', async () => {
      const txRepo = makeTxRepo();
      txRepo.findByUser.mockResolvedValue([
        { type: 'expense', amount: { value: 30, currency: 'CHF' }, categoryId: undefined, date: PAST_DATE, accountId: 'acc-1' },
        { type: 'expense', amount: { value: 20, currency: 'CHF' }, categoryId: undefined, date: PAST_DATE, accountId: 'acc-1' },
      ]);

      const service = new DashboardService(
        makeAccountRepo([makeAccount()]) as any,
        txRepo as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      const uncategorized = result.categoryBreakdown.find(c => c.categoryId === null);
      expect(uncategorized?.total).toBe(50);
    });
  });

  describe('getDashboard - endOfMonthProjection', () => {
    it('nominal: sums opening balance + past and future transactions within the month', async () => {
      const accounts = [makeAccount({ id: 'acc-1', balance: 1000 })];
      const txRepo = makeTxRepo([
        { type: 'income',  amount: { value: 200 }, date: PAST_DATE,           accountId: 'acc-1' },
        { type: 'expense', amount: { value: 50  }, date: FUTURE_WITHIN_MONTH, accountId: 'acc-1' },
      ]);

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, txRepo as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      // 1000 (opening) + 200 (income) - 50 (expense)
      expect(result.endOfMonthProjection).toBe(1150);
    });

    it('includes an account whose opening date is exactly the last day of the month', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000 }),
        makeAccount({ id: 'acc-2', balance: 500, createdAt: REF_EOM }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, makeTxRepo() as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.endOfMonthProjection).toBe(1500);
    });

    it('excludes an account that opens the day after EOM', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000 }),
        makeAccount({ id: 'acc-2', balance: 500, createdAt: FIRST_DAY_NEXT_MONTH }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, makeTxRepo() as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.endOfMonthProjection).toBe(1000); // acc-2 excluded
    });

    it('includes a transaction dated exactly on the last day of the month', async () => {
      const accounts = [makeAccount({ id: 'acc-1', balance: 1000 })];
      const txRepo = makeTxRepo([
        { type: 'income', amount: { value: 300 }, date: REF_EOM, accountId: 'acc-1' },
      ]);

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, txRepo as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.endOfMonthProjection).toBe(1300);
    });

    it('excludes a transaction dated after the last day of the month', async () => {
      const accounts = [makeAccount({ id: 'acc-1', balance: 1000 })];
      const txRepo = makeTxRepo([
        { type: 'income', amount: { value: 999 }, date: FIRST_DAY_NEXT_MONTH, accountId: 'acc-1' },
      ]);

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, txRepo as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.endOfMonthProjection).toBe(1000); // future tx excluded
    });

    it('includes an account that opens between today and EOM (future opening but before EOM)', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000 }),
        makeAccount({ id: 'acc-2', balance: 400, createdAt: FUTURE_WITHIN_MONTH }),
      ];

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, makeTxRepo() as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      // acc-2 opens before EOM → included in EOM but NOT in totalCash
      expect(result.endOfMonthProjection).toBe(1400);
      expect(result.totalCash).toBe(1000);
    });

    it('applies FX conversion for foreign currency accounts', async () => {
      const accounts = [
        makeAccount({ id: 'acc-1', balance: 1000, currency: 'CHF' }),
        makeAccount({ id: 'acc-2', balance: 100, currency: 'EUR' }),
      ];
      const txRepo = makeTxRepo([
        { type: 'income', amount: { value: 50 }, date: FUTURE_WITHIN_MONTH, accountId: 'acc-2' },
      ]);

      const service = new DashboardService(
        makeAccountRepo(accounts) as any, txRepo as any,
        makeRecurringRepo() as any, makeFirestoreMock('CHF', { EUR: 1.05 }) as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      // EOM: 1000 CHF + (100 + 50) EUR * 1.05
      expect(result.endOfMonthProjection).toBeCloseTo(1000 + 150 * 1.05, 2);
    });

    it('returns 0 when no accounts exist', async () => {
      const service = new DashboardService(
        makeAccountRepo([]) as any, makeTxRepo() as any,
        makeRecurringRepo() as any, makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.endOfMonthProjection).toBe(0);
    });

    it('includes transactions within the month + excludes future accounts (edge case: March 1 snapshot)', async () => {
      const accounts = [
        makeAccount({ id: 'acc-eur-1', balance: 1500, currency: 'EUR', createdAt: MARCH_20_2026 }),
        makeAccount({ id: 'acc-apr', balance: 2000, currency: 'EUR', createdAt: APRIL_1_2026 }),
      ];
      const txRepo = makeTxRepo([
        { type: 'expense', amount: { value: 500 }, date: MARCH_20_2026, accountId: 'acc-eur-1' },
      ]);

      // Query as of March 1st (account 1 doesn't exist yet, account 2 opens in April)
      const service = new DashboardService(
        makeAccountRepo(accounts) as any, txRepo as any,
        makeRecurringRepo() as any, makeFirestoreMock('EUR', {}) as any,
      );

      const result = await service.getDashboard('user-1', MARCH_1_2026);
      // EOM: acc-eur-1 opens March 20 (1500 - 500 = 1000) + no acc-apr since it opens after EOM
      expect(result.endOfMonthProjection).toBe(1000);
      // totalCash on March 1: no accounts open yet (acc-eur-1 opens March 20, acc-apr opens April 1)
      expect(result.totalCash).toBe(0);
    });
  });

  describe('getDashboard - accounts in response', () => {
    it('includes createdAt as ISO string in accounts', async () => {
      const service = new DashboardService(
        makeAccountRepo([makeAccount()]) as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      const result = await service.getDashboard('user-1', REF_NOW);
      expect(result.accounts).toHaveLength(1);
      expect(typeof result.accounts[0].createdAt).toBe('string');
      // Valid ISO string
      expect(() => new Date(result.accounts[0].createdAt)).not.toThrow();
    });

    it('returns only active accounts', async () => {
      // The repo is called with includeArchived=false
      const accountRepo = makeAccountRepo([makeAccount()]);

      const service = new DashboardService(
        accountRepo as any,
        makeTxRepo() as any,
        makeRecurringRepo() as any,
        makeFirestoreMock() as any,
      );

      await service.getDashboard('user-1', REF_NOW);
      expect(accountRepo.findAllByUser).toHaveBeenCalledWith('user-1', false);
    });
  });
});
