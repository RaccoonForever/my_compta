import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountsService } from './accounts.service.js';
import { NotFoundError, Account } from '@my-compta/domain';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAccount(overrides: Partial<{
  id: string;
  balance: number;
  isArchived: boolean;
  currency: string;
}> = {}): Account {
  const {
    id = 'acc-1',
    balance = 1000,
    currency = 'CHF',
  } = overrides;

  const acc = Account.create({
    id,
    userId: 'user-1',
    name: 'Test Account',
    type: 'bank',
    currency: currency as any,
    balance,
  });

  if (overrides.isArchived) {
    return acc.archive();
  }

  return acc;
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

describe('AccountsService', () => {
  let service: AccountsService;
  let accountRepo: ReturnType<typeof makeAccountRepo>;
  let idGen: ReturnType<typeof makeIdGenerator>;

  beforeEach(() => {
    accountRepo = makeAccountRepo();
    idGen = makeIdGenerator('new-acc-id');

    service = new AccountsService(accountRepo as any, idGen as any);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('creates and saves a new account with given balance', async () => {
      const acc = await service.create('user-1', {
        name: 'Savings',
        type: 'bank',
        currency: 'CHF',
        balance: 500,
      });

      expect(accountRepo.save).toHaveBeenCalledOnce();
      expect(acc.balance).toBe(500);
      expect(acc.name).toBe('Savings');
    });

    it('defaults balance to 0 if not provided', async () => {
      const acc = await service.create('user-1', {
        name: 'Wallet',
        type: 'wallet',
        currency: 'EUR',
      });

      expect(acc.balance).toBe(0);
    });

    it('uses the generated id', async () => {
      const acc = await service.create('user-1', {
        name: 'Crypto',
        type: 'crypto',
        currency: 'USD',
      });

      expect(acc.id).toBe('new-acc-id');
      expect(idGen.generate).toHaveBeenCalledOnce();
    });
  });

  // ── list ──────────────────────────────────────────────────────────────────

  describe('list', () => {
    it('returns all accounts for a user', async () => {
      const accounts = [makeAccount({ id: 'acc-1' }), makeAccount({ id: 'acc-2' })];
      accountRepo.findAllByUser.mockResolvedValue(accounts);

      const result = await service.list('user-1');
      expect(result).toHaveLength(2);
      expect(accountRepo.findAllByUser).toHaveBeenCalledWith('user-1', false);
    });

    it('passes includeArchived flag to repository', async () => {
      await service.list('user-1', true);
      expect(accountRepo.findAllByUser).toHaveBeenCalledWith('user-1', true);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundError when account does not exist', async () => {
      accountRepo.findById.mockResolvedValue(null);

      await expect(service.update('user-1', 'acc-missing', { name: 'New' }))
        .rejects.toThrow(NotFoundError);
    });

    it('updates account name and saves', async () => {
      accountRepo.findById.mockResolvedValue(makeAccount());

      const updated = await service.update('user-1', 'acc-1', { name: 'Updated' });

      expect(accountRepo.save).toHaveBeenCalledOnce();
      expect(updated.name).toBe('Updated');
    });
  });

  // ── archive ───────────────────────────────────────────────────────────────

  describe('archive', () => {
    it('throws NotFoundError when account does not exist', async () => {
      accountRepo.findById.mockResolvedValue(null);

      await expect(service.archive('user-1', 'acc-missing')).rejects.toThrow(NotFoundError);
    });

    it('archives the account and saves it', async () => {
      accountRepo.findById.mockResolvedValue(makeAccount());

      const archived = await service.archive('user-1', 'acc-1');

      expect(accountRepo.save).toHaveBeenCalledOnce();
      expect(archived.isArchived).toBe(true);
    });
  });

});

