import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TransactionsService } from './transactions.service.js';
import { NotFoundError, ValidationError, Money, Transaction } from '@my-compta/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<{
  id: string;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  currency: string;
  date: Date;
  accountId: string;
  transferLinkId?: string;
}> = {}): Transaction {
  const {
    id = 'tx-1',
    type = 'expense',
    amount = 100,
    currency = 'CHF',
    date = new Date('2025-01-15'),
    accountId = 'acc-1',
    transferLinkId,
  } = overrides;

  return Transaction.create({
    id,
    userId: 'user-1',
    accountId,
    type,
    amount: Money.of(amount, currency),
    date,
    label: 'Test transaction',
    transferLinkId,
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

function makeIdGenerator(id = 'generated-id') {
  return { generate: vi.fn().mockReturnValue(id) };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TransactionsService', () => {
  let service: TransactionsService;
  let txRepo: ReturnType<typeof makeTxRepo>;
  let accountRepo: ReturnType<typeof makeAccountRepo>;
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
    idGen = makeIdGenerator('new-id');

    service = new TransactionsService(
      txRepo as any,
      accountRepo as any,
      idGen as any,
    );
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws ValidationError when type is transfer', async () => {
      await expect(service.create('user-1', {
        type: 'transfer',
        amount: 100,
        currency: 'CHF',
        date: TODAY.toISOString(),
        accountId: 'acc-1',
        label: 'Test',
      })).rejects.toThrow(ValidationError);
    });

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
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('throws NotFoundError when transaction does not exist', async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(service.delete('user-1', 'tx-missing')).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when deleting a transfer transaction', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ transferLinkId: 'link-1', type: 'transfer' }));

      await expect(service.delete('user-1', 'tx-1')).rejects.toThrow(ValidationError);
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

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundError when transaction does not exist', async () => {
      txRepo.findById.mockResolvedValue(null);

      await expect(service.update('user-1', 'tx-missing', { label: 'New' })).rejects.toThrow(NotFoundError);
    });

    it('throws ValidationError when editing a transfer', async () => {
      txRepo.findById.mockResolvedValue(makeTx({ transferLinkId: 'link-1', type: 'transfer' }));

      await expect(service.update('user-1', 'tx-1', { label: 'Edit' })).rejects.toThrow(ValidationError);
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
