import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionsService } from './transactions.service.js';
import { NotFoundError, ValidationError, Money, Transaction } from '@my-compta/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<{
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: Date;
  accountId: string;
  isForecasted?: boolean;
}> = {}): Transaction {
  const {
    id = 'tx-1',
    type = 'expense',
    amount = 100,
    currency = 'CHF',
    date = new Date('2025-01-15'),
    accountId = 'acc-1',
    isForecasted,
  } = overrides;

  return Transaction.create({
    id,
    userId: 'user-1',
    accountId,
    type,
    isForecasted,
    amount: Money.of(amount, currency),
    date,
    label: 'Test transaction',
  });
}

// ── Mocks ────────────────────────────────────────────────────────────────────

function makeTxRepo() {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAccountRepo() {
  return {
    findById: vi.fn().mockResolvedValue(null),
    findAllByUser: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    applyDeltaRef: vi.fn(),
  };
}

function makeRecurringRepo() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAllByUser: vi.fn().mockResolvedValue([]),
    findDue: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeIdGenerator(id = 'generated-id') {
  return { generate: vi.fn().mockReturnValue(id) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: ReturnType<typeof makeTxRepo>;
  let accountRepo: ReturnType<typeof makeAccountRepo>;
  let recurringRepo: ReturnType<typeof makeRecurringRepo>;
  let idGen: ReturnType<typeof makeIdGenerator>;

  const TODAY = new Date();
  TODAY.setHours(12, 0, 0, 0);
  const PAST_DATE = new Date('2025-01-15');
  const FUTURE_DATE = new Date(TODAY.getTime() + 5 * 24 * 60 * 60 * 1000);

  const mockAccount = {
    id: 'acc-1',
    userId: 'user-1',
    name: 'Test Account',
    type: 'bank',
    currency: 'CHF',
    balance: 1000,
  };

  beforeEach(() => {
    txRepo = makeTxRepo();
    accountRepo = makeAccountRepo();
    recurringRepo = makeRecurringRepo();
    idGen = makeIdGenerator('new-id');

    service = new TransactionsService(
      txRepo as any,
      accountRepo as any,
      recurringRepo as any,
      idGen as any,
    );
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws NotFoundError when account does not exist', async () => {
      accountRepo.findById.mockResolvedValue(null);

      await expect(service.create('user-1', {
        type: 'income',
        amount: 100,
        currency: 'CHF',
        date: TODAY.toISOString(),
        accountId: 'acc-missing',
        label: 'Test',
      })).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when transaction date is before account creation date', async () => {
      const accountCreatedDate = new Date('2025-06-01');
      const txDateBefore = new Date('2025-05-15');
      const accountWithCreatedAt = { ...mockAccount, createdAt: accountCreatedDate };
      accountRepo.findById.mockResolvedValue(accountWithCreatedAt as any);

      await expect(service.create('user-1', {
        type: 'expense',
        amount: 100,
        currency: 'CHF',
        date: txDateBefore.toISOString(),
        accountId: 'acc-1',
        label: 'Invalid transaction',
      })).rejects.toThrow(ValidationError);
    });

    it('saves the transaction via repo for a past date', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      const tx = await service.create('user-1', {
        type: 'expense',
        amount: 50,
        currency: 'CHF',
        date: PAST_DATE.toISOString(),
        accountId: 'acc-1',
        label: 'Groceries',
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(txRepo.save).toHaveBeenCalledWith(tx);
    });

    it('saves the transaction via repo for a future date (no balance side-effect)', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      const tx = await service.create('user-1', {
        type: 'expense',
        amount: 50,
        currency: 'CHF',
        date: FUTURE_DATE.toISOString(),
        accountId: 'acc-1',
        label: 'Future bill',
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(txRepo.save).toHaveBeenCalledWith(tx);
    });

    it('returns a transaction with the correct type and amount', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      const tx = await service.create('user-1', {
        type: 'income',
        amount: 200,
        currency: 'CHF',
        date: PAST_DATE.toISOString(),
        accountId: 'acc-1',
        label: 'Salary',
      });

      expect(tx.type).toBe('income');
      expect(tx.amount.value).toBe(200);
      expect(tx.accountId).toBe('acc-1');
    });

    it('creates a recurring template when recurring config is provided', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      await service.create('user-1', {
        type: 'income',
        amount: 2000,
        currency: 'CHF',
        date: '2026-03-01',
        accountId: 'acc-1',
        label: 'Salary',
        recurring: {
          frequency: 'monthly',
          interval: 1,
          byMonthDay: 1,
          endDate: '2027-03-01',
          tz: 'Europe/Zurich',
        },
      });

      expect(recurringRepo.save).toHaveBeenCalledOnce();
      const savedTemplate = recurringRepo.save.mock.calls[0]?.[0];
      expect(savedTemplate.label).toBe('Salary');
      expect(savedTemplate.schedule.frequency).toBe('monthly');
      expect(savedTemplate.endDate.toISOString().slice(0, 10)).toBe('2027-03-01');

      const persisted = savedTemplate.toPrimitives();
      expect('byDay' in persisted.schedule).toBe(false);
      expect(persisted.schedule.byMonthDay).toBe(1);

      // 1 initial transaction + 12 monthly forecasted transactions
      expect(txRepo.save).toHaveBeenCalledTimes(13);

      const savedTransactions = txRepo.save.mock.calls.map(call => call[0]);
      const forecasted = savedTransactions.filter((tx: Transaction) => tx.isForecasted);
      expect(forecasted.length).toBe(12);
      expect(
        forecasted.every((tx: Transaction) => tx.recurringInstanceId !== undefined),
      ).toBe(true);
    });

    it('creates daily recurring forecasted transactions up to endDate', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      await service.create('user-1', {
        type: 'expense',
        amount: 10,
        currency: 'CHF',
        date: '2026-03-01',
        accountId: 'acc-1',
        label: 'Coffee',
        recurring: {
          frequency: 'daily',
          interval: 1,
          endDate: '2026-03-03',
        },
      });

      // 1 initial + 2 future daily occurrences (02 and 03)
      expect(txRepo.save).toHaveBeenCalledTimes(3);

      const savedTransactions = txRepo.save.mock.calls.map(call => call[0] as Transaction);
      const forecasted = savedTransactions.filter(tx => tx.isForecasted);
      expect(forecasted.length).toBe(2);
      expect(forecasted[0]?.date.toISOString().slice(0, 10)).toBe('2026-03-02');
      expect(forecasted[1]?.date.toISOString().slice(0, 10)).toBe('2026-03-03');
    });

    it('rejects recurring endDate beyond 2 years', async () => {
      accountRepo.findById.mockResolvedValue(mockAccount);

      await expect(service.create('user-1', {
        type: 'expense',
        amount: 150,
        currency: 'CHF',
        date: '2026-03-01',
        accountId: 'acc-1',
        label: 'Long running',
        recurring: {
          frequency: 'monthly',
          interval: 1,
          endDate: '2028-03-02',
        },
      })).rejects.toThrow(ValidationError);

      expect(recurringRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws NotFoundError when transaction does not exist', async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(service.delete('user-1', 'tx-missing')).rejects.toThrow(NotFoundError);
    });

    it('deletes the transaction via repo for a past transaction', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ type: 'expense', amount: 100, date: PAST_DATE }));

      await service.delete('user-1', 'tx-1');

      expect(txRepo.delete).toHaveBeenCalledOnce();
      expect(txRepo.delete).toHaveBeenCalledWith('user-1', 'tx-1');
    });

    it('deletes the transaction via repo for a future transaction', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ type: 'expense', amount: 100, date: FUTURE_DATE }));

      await service.delete('user-1', 'tx-1');

      expect(txRepo.delete).toHaveBeenCalledOnce();
      expect(txRepo.delete).toHaveBeenCalledWith('user-1', 'tx-1');
    });
  });

  describe('refreshForecast', () => {
    it('removes forecast transactions up to latest real transaction date', async () => {
      const real = makeTx({ id: 'real-1', isForecasted: false, date: new Date('2026-03-10') });
      const oldForecast = makeTx({ id: 'f-old', isForecasted: true, date: new Date('2026-03-05') });
      const sameDayForecast = makeTx({ id: 'f-same', isForecasted: true, date: new Date('2026-03-10') });
      const futureForecast = makeTx({ id: 'f-future', isForecasted: true, date: new Date('2026-03-11') });

      txRepo.findByUser.mockResolvedValue([real, oldForecast, sameDayForecast, futureForecast]);

      const result = await service.refreshForecast('user-1');

      expect(result.removedCount).toBe(2);
      expect(txRepo.delete).toHaveBeenCalledTimes(2);
      expect(txRepo.delete).toHaveBeenNthCalledWith(1, 'user-1', 'f-old');
      expect(txRepo.delete).toHaveBeenNthCalledWith(2, 'user-1', 'f-same');
    });

    it('does nothing when user has no real transaction', async () => {
      const forecastOnly = makeTx({ id: 'f-only', isForecasted: true, date: new Date('2026-03-11') });
      txRepo.findByUser.mockResolvedValue([forecastOnly]);

      const result = await service.refreshForecast('user-1');

      expect(result.removedCount).toBe(0);
      expect(txRepo.delete).not.toHaveBeenCalled();
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundError when transaction does not exist', async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(service.update('user-1', 'tx-missing', { label: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('saves updated transaction via repo when amount changes', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ type: 'expense', amount: 100, date: PAST_DATE }));

      const updated = await service.update('user-1', 'tx-1', {
        amount: 150,
        currency: 'CHF',
        date: new Date('2025-02-01').toISOString(),
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(updated.amount.value).toBe(150);
    });

    it('saves updated transaction via repo for future dates', async () => {
      const anotherFuture = new Date(TODAY.getTime() + 10 * 24 * 60 * 60 * 1000);
      txRepo.findById.mockResolvedValue(makeTx({ type: 'expense', amount: 100, date: FUTURE_DATE }));

      const updated = await service.update('user-1', 'tx-1', {
        amount: 200,
        currency: 'CHF',
        date: anotherFuture.toISOString(),
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(updated.amount.value).toBe(200);
    });

    it('saves updated transaction when moving from past to future', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ type: 'expense', amount: 100, date: PAST_DATE }));

      const updated = await service.update('user-1', 'tx-1', {
        date: FUTURE_DATE.toISOString(),
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(updated.date.getTime()).toBe(FUTURE_DATE.getTime());
    });

    it('saves updated transaction when moving from future to past', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ type: 'income', amount: 100, date: FUTURE_DATE }));

      const updated = await service.update('user-1', 'tx-1', {
        date: PAST_DATE.toISOString(),
      });

      expect(txRepo.save).toHaveBeenCalledOnce();
      expect(updated.date.getTime()).toBe(PAST_DATE.getTime());
    });
  });
});
