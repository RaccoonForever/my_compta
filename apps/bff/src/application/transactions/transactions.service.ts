import { Inject, Injectable } from '@nestjs/common';
import { Money, Transaction, NotFoundError, ValidationError } from '@my-compta/domain';
import {
  TransactionRepository,
  TRANSACTION_REPOSITORY,
  TransactionFilters,
} from '../ports/TransactionRepository.js';
import { AccountRepository, ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { CreateTransactionDto } from './dto/CreateTransactionDto.js';
import { UpdateTransactionDto } from './dto/UpdateTransactionDto.js';
import { AutocompleteResponseDto } from './dto/TransactionResponseDto.js';

@Injectable()
export class TransactionsService {
  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly txRepo: TransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepo: AccountRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    if (dto.type === 'transfer') {
      throw new ValidationError('Transfer transactions are not supported');
    }

    const account = await this.accountRepo.findById(userId, dto.accountId);
    if (!account) throw new NotFoundError('Account', dto.accountId);

    const txDate = new Date(dto.date);
    if (txDate < account.createdAt) {
      throw new ValidationError(`Transaction date (${txDate.toISOString()}) cannot be before account creation date (${account.createdAt.toISOString()})`);
    }

    const amount = Money.of(dto.amount, dto.currency);

    const transaction = Transaction.create({
      id: this.idGenerator.generate(),
      userId,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      type: dto.type,
      amount,
      date: txDate,
      label: dto.label,
      note: dto.note,
    });

    await this.txRepo.save(transaction);
    return transaction;
  }

  async list(userId: string, filters: TransactionFilters): Promise<Transaction[]> {
    return this.txRepo.findByUser(userId, filters);
  }

  async findById(userId: string, id: string): Promise<Transaction> {
    const tx = await this.txRepo.findById(userId, id);
    if (!tx) throw new NotFoundError('Transaction', id);
    return tx;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTransactionDto,
  ): Promise<Transaction> {
    const existing = await this.txRepo.findById(userId, id);
    if (!existing) throw new NotFoundError('Transaction', id);
    if (existing.isTransfer()) {
      throw new ValidationError('Transfer transactions are not supported');
    }

    const newAmount = dto.amount !== undefined
      ? Money.of(dto.amount, dto.currency ?? existing.amount.currency)
      : existing.amount;

    const newDate = dto.date ? new Date(dto.date) : existing.date;

    const updated = Transaction.create({
      id: existing.id,
      userId,
      accountId: existing.accountId,
      categoryId: dto.categoryId ?? existing.categoryId,
      type: existing.type,
      amount: newAmount,
      date: newDate,
      label: dto.label ?? existing.label,
      note: dto.note ?? existing.note,
      transferLinkId: existing.transferLinkId,
      recurringInstanceId: existing.recurringInstanceId,
    });

    await this.txRepo.save(updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const tx = await this.txRepo.findById(userId, id);
    if (!tx) throw new NotFoundError('Transaction', id);
    if (tx.isTransfer()) {
      throw new ValidationError('Transfer transactions are not supported');
    }
    await this.txRepo.delete(userId, id);
  }

  /**
   * Returns autocomplete suggestions by matching the label prefix
   * against the user's transaction history.
   * Returns the most recently used metadata for each distinct label.
   */
  async autocomplete(
    userId: string,
    labelPrefix: string,
  ): Promise<AutocompleteResponseDto[]> {
    if (!labelPrefix || labelPrefix.length < 2) return [];

    // Firestore doesn't support LIKE queries natively.
    // We fetch the last 500 transactions and filter client-side for MVP.
    const recent = await this.txRepo.findByUser(userId, { limit: 500 });
    const prefix = labelPrefix.toLowerCase();

    const seen = new Map<string, AutocompleteResponseDto>();
    for (const tx of recent) {
      if (tx.label.toLowerCase().startsWith(prefix) && !seen.has(tx.label)) {
        seen.set(tx.label, {
          label: tx.label,
          amount: tx.amount.abs().value,
          currency: tx.amount.currency,
          categoryId: tx.categoryId,
          type: tx.type,
        });
      }
    }
    return [...seen.values()].slice(0, 10);
  }
}
