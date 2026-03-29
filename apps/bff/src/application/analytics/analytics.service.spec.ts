import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Money, Transaction } from '@my-compta/domain';
import { AnalyticsService } from './analytics.service.js';

function makeTx(overrides: Partial<{
  id: string;
  type: 'income' | 'expense';
  amount: number;
  currency: string;
  date: Date;
  projectIds: string[];
}> = {}): Transaction {
  const {
    id = 'tx-1',
    type = 'expense',
    amount = 100,
    currency = 'CHF',
    date = new Date('2026-01-15T00:00:00.000Z'),
    projectIds = [],
  } = overrides;

  return Transaction.create({
    id,
    userId: 'user-1',
    accountId: 'acc-1',
    type,
    amount: Money.of(amount, currency),
    date,
    label: 'Test',
    projectIds,
  });
}

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let txRepo: { findByUser: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    txRepo = {
      findByUser: vi.fn().mockResolvedValue([]),
    };

    service = new AnalyticsService(txRepo as any);
  });

  it('computes project analytics using only transactions tagged with selected project', async () => {
    txRepo.findByUser.mockResolvedValue([
      makeTx({ id: 't1', type: 'expense', amount: 120, projectIds: ['proj-1'] }),
      makeTx({ id: 't2', type: 'income', amount: 350, projectIds: ['proj-1'] }),
      makeTx({ id: 't3', type: 'expense', amount: 99, projectIds: ['proj-2'] }),
      makeTx({ id: 't4', type: 'expense', amount: 80, projectIds: ['proj-1', 'proj-2'] }),
    ]);

    const result = await service.getProjectAnalytics('user-1', 'proj-1');

    expect(result.projectId).toBe('proj-1');
    expect(result.totalIncome).toBe(350);
    expect(result.totalExpenses).toBe(200);
    expect(result.net).toBe(150);
    expect(result.transactions.map(t => t.id).sort()).toEqual(['t1', 't2', 't4']);
    expect(result.transactions).toHaveLength(3);
    expect(txRepo.findByUser).toHaveBeenCalledWith('user-1');
  });

  it('includes tagged transactions even when project ids come in legacy/malformed shapes', async () => {
    const normal = makeTx({ id: 'n1', type: 'expense', amount: 20, projectIds: ['proj-1'] });
    const legacyStringShape = {
      ...makeTx({ id: 'l1', type: 'income', amount: 80, projectIds: [] }),
      projectIds: 'proj-1',
    } as unknown as Transaction;
    const legacySingleField = {
      ...makeTx({ id: 'l2', type: 'expense', amount: 10, projectIds: [] }),
      projectId: 'proj-1',
    } as unknown as Transaction;

    txRepo.findByUser.mockResolvedValue([
      normal,
      legacyStringShape,
      legacySingleField,
      makeTx({ id: 'x1', type: 'expense', amount: 999, projectIds: ['proj-2'] }),
    ]);

    const result = await service.getProjectAnalytics('user-1', 'proj-1');

    expect(result.transactions.map(t => t.id).sort()).toEqual(['l1', 'l2', 'n1']);
    expect(result.totalIncome).toBe(80);
    expect(result.totalExpenses).toBe(30);
  });
});
