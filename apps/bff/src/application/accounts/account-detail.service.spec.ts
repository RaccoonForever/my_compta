import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Account, Currency } from '@my-compta/domain';
import { AccountDetailService } from './account-detail.service.js';
import type {
  AccountRepository,
  TransactionRepository,
  RecurringRepository,
} from '../ports/index.js';
import type * as admin from 'firebase-admin';

describe('AccountDetailService', () => {
  let service: AccountDetailService;
  let mockAccountRepo: AccountRepository;
  let mockTxRepo: TransactionRepository;
  let mockRecurringRepo: RecurringRepository;
  let mockDb: Partial<admin.firestore.Firestore>;

  const userId = 'user-123';
  const accountId = 'acc-1';
  const now = new Date('2024-01-15T10:00:00Z');

  beforeEach(() => {
    const baseAccount = Account.create({
      id: accountId,
      userId,
      name: 'Checking',
      currency: 'CHF' as any,
      balance: 1000,
      type: 'checking',
      createdAt: new Date('2023-06-01'),
    });

    mockAccountRepo = {
      findById: vi.fn().mockResolvedValue(baseAccount),
    } as Partial<AccountRepository> as AccountRepository;

    mockTxRepo = {
      findByUser: vi.fn(async (uid: string, filters?: any) => {
        if (filters?.limit) {
          // Recent transactions
          return [
            { id: 'tx-1', userId, accountId, type: 'income', amount: { value: 500, currency: 'CHF' }, date: new Date('2024-01-10'), label: 'Salary' },
            { id: 'tx-2', userId, accountId, type: 'expense', amount: { value: 100, currency: 'CHF' }, date: new Date('2024-01-12'), label: 'Coffee', categoryId: 'cat-food' },
          ];
        }
        // All transactions to EOM
        return [
          { id: 'tx-1', userId, accountId, type: 'income', amount: { value: 500, currency: 'CHF' }, date: new Date('2024-01-10'), label: 'Salary' },
          { id: 'tx-2', userId, accountId, type: 'expense', amount: { value: 100, currency: 'CHF' }, date: new Date('2024-01-12'), label: 'Coffee', categoryId: 'cat-food' },
          { id: 'tx-3', userId, accountId, type: 'expense', amount: { value: 50, currency: 'CHF' }, date: new Date('2024-01-20'), label: 'Lunch', categoryId: 'cat-food' },
        ];
      }),
    } as Partial<TransactionRepository> as TransactionRepository;

    mockRecurringRepo = {
      findAllByUser: vi.fn().mockResolvedValue([]),
    } as Partial<RecurringRepository> as RecurringRepository;

    mockDb = {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              baseCurrency: 'CHF',
              fxRates: { EUR: 0.95, USD: 1.1 },
            }),
          }),
        }),
      }),
    } as Partial<admin.firestore.Firestore> as admin.firestore.Firestore;

    service = new AccountDetailService(
      mockAccountRepo,
      mockTxRepo,
      mockRecurringRepo,
      mockDb,
    );
  });

  it('should return account detail with income included', async () => {
    const detail = await service.getAccountDetail(userId, accountId, now);

    expect(detail).toBeDefined();
    expect(detail.account.id).toBe(accountId);
    expect(detail.account.name).toBe('Checking');
    expect(detail.mtd.income).toBe(500); // Income from 2024-01-10
    expect(detail.mtd.expenses).toBe(100); // Only expense from 2024-01-12 (before now)
  });

  it('should compute current balance correctly', async () => {
    const detail = await service.getAccountDetail(userId, accountId, now);

    expect(detail.currentBalance).toBe(1000); // Same as account balance in CHF
  });

  it('should compute end of month projection including future transactions', async () => {
    const detail = await service.getAccountDetail(userId, accountId, now);

    // Account balance 1000 already includes past transactions (income 500 - expense 100)
    // Future transaction within EOM: expense 50
    // FX is CHF (1:1), so EOM projection = 1000 - 50 = 950
    expect(detail.endOfMonthProjection).toBe(950);
  });

  it('should generate category breakdown for MTD expenses', async () => {
    const detail = await service.getAccountDetail(userId, accountId, now);

    // Only expense from 2024-01-12 is included in MTD
    expect(detail.categoryBreakdown).toHaveLength(1);
    const foodExpense = detail.categoryBreakdown.find(
      b => b.categoryId === 'cat-food',
    );
    expect(foodExpense?.total).toBe(100);
  });

  it('should include recent transactions in response', async () => {
    const detail = await service.getAccountDetail(userId, accountId, now);

    expect(detail.recentTransactions).toHaveLength(2);
    expect(detail.recentTransactions[0].amount).toBe(500);
    expect(detail.recentTransactions[0].type).toBe('income');
    expect(detail.recentTransactions[1].amount).toBe(100);
    expect(detail.recentTransactions[1].type).toBe('expense');
  });

  it('should apply FX conversion for multi-currency accounts', async () => {
    const eurAccount = Account.create({
      id: 'acc-2',
      userId,
      name: 'EUR Account',
      currency: 'EUR' as any,
      balance: 1000,
      type: 'checking',
      createdAt: new Date('2023-06-01'),
    });

    mockAccountRepo = {
      findById: vi.fn().mockResolvedValue(eurAccount),
    } as Partial<AccountRepository> as AccountRepository;

    service = new AccountDetailService(
      mockAccountRepo,
      mockTxRepo,
      mockRecurringRepo,
      mockDb,
    );

    const detail = await service.getAccountDetail(userId, 'acc-2', now);

    // 1000 EUR * 0.95 = 950 CHF
    expect(detail.currentBalance).toBe(950);
  });

  it('should throw when account not found', async () => {
    mockAccountRepo = {
      findById: vi.fn().mockResolvedValue(null),
    } as any;

    service = new AccountDetailService(
      mockAccountRepo,
      mockTxRepo,
      mockRecurringRepo,
      mockDb,
    );

    await expect(
      service.getAccountDetail(userId, 'nonexistent', now),
    ).rejects.toThrow();
  });

  it('should handle accounts with no transactions', async () => {
    mockTxRepo = {
      findByUser: vi.fn().mockResolvedValue([]),
    } as Partial<TransactionRepository> as TransactionRepository;

    service = new AccountDetailService(
      mockAccountRepo,
      mockTxRepo,
      mockRecurringRepo,
      mockDb,
    );

    const detail = await service.getAccountDetail(userId, accountId, now);

    expect(detail.mtd.income).toBe(0);
    expect(detail.mtd.expenses).toBe(0);
    expect(detail.categoryBreakdown).toHaveLength(0);
    expect(detail.recentTransactions).toHaveLength(0);
  });
});

