import { Inject, Injectable } from '@nestjs/common';
import {
  Money,
  Transaction,
  NotFoundError,
  ValidationError,
  RecurringTemplate,
  RecurringSchedulerService,
} from '@my-compta/domain';
import {
  TransactionRepository,
  TRANSACTION_REPOSITORY,
  TransactionFilters,
} from '../ports/TransactionRepository.js';
import { AccountRepository, ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { RecurringRepository, RECURRING_REPOSITORY } from '../ports/RecurringRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { CreateTransactionDto } from './dto/CreateTransactionDto.js';
import { UpdateTransactionDto } from './dto/UpdateTransactionDto.js';
import { AutocompleteResponseDto } from './dto/TransactionResponseDto.js';

@Injectable()
export class TransactionsService {
  private readonly recurringScheduler = new RecurringSchedulerService();

  constructor(
    @Inject(TRANSACTION_REPOSITORY)
    private readonly txRepo: TransactionRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepo: AccountRepository,
    @Inject(RECURRING_REPOSITORY)
    private readonly recurringRepo: RecurringRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
  ) {}

  async create(userId: string, dto: CreateTransactionDto): Promise<Transaction> {
    const account = await this.accountRepo.findById(userId, dto.accountId);
    if (!account) throw new NotFoundError('Account', dto.accountId);

    const txDate = new Date(dto.date);
    if (txDate < account.createdAt) {
      throw new ValidationError(`Transaction date (${txDate.toISOString()}) cannot be before account creation date (${account.createdAt.toISOString()})`);
    }

    const amount = Money.of(dto.amount, dto.currency);

    let recurringTemplate: RecurringTemplate | undefined;
    const recurringForecastTransactions: Transaction[] = [];

    if (dto.recurring) {
      const endDate = new Date(dto.recurring.endDate);
      if (Number.isNaN(endDate.getTime())) {
        throw new ValidationError('Invalid recurring endDate');
      }

      const maxEndDate = new Date(txDate);
      maxEndDate.setUTCFullYear(maxEndDate.getUTCFullYear() + 2);

      if (endDate > maxEndDate) {
        throw new ValidationError(
          'Recurring endDate cannot be more than 2 years after transaction date',
        );
      }

      const schedule = {
        frequency: dto.recurring.frequency,
        interval: dto.recurring.interval,
        ...(dto.recurring.byDay !== undefined
          ? { byDay: dto.recurring.byDay }
          : {}),
        ...(dto.recurring.byMonthDay !== undefined
          ? { byMonthDay: dto.recurring.byMonthDay }
          : {}),
      };

      const nextRunDate = this.recurringScheduler.computeNextDate(
        txDate,
        schedule,
        dto.recurring.tz ?? 'Europe/Zurich',
      );

      if (endDate < nextRunDate) {
        throw new ValidationError(
          'Recurring endDate must be on or after the next recurring occurrence',
        );
      }

      recurringTemplate = RecurringTemplate.create({
        id: this.idGenerator.generate(),
        userId,
        label: dto.label,
        amount: { value: dto.amount, currency: dto.currency },
        type: dto.type,
        categoryId: dto.categoryId,
        accountId: dto.accountId,
        schedule,
        nextRunDate,
        endDate,
        tz: dto.recurring.tz,
      });

      // Pre-generate forecasted recurring instances up to the configured end date
      // so recurrence is immediately visible to the user.
      let occurrenceDate = nextRunDate;
      while (occurrenceDate <= endDate) {
        const recurringInstanceId = this.recurringScheduler.instanceKey(
          recurringTemplate.id,
          occurrenceDate,
        );

        recurringForecastTransactions.push(
          Transaction.create({
            id: this.idGenerator.generate(),
            userId,
            accountId: dto.accountId,
            categoryId: dto.categoryId,
            subcategory: dto.subcategory,
            type: dto.type,
            isForecasted: true,
            amount,
            date: occurrenceDate,
            label: dto.label,
            note: dto.note,
            recurringInstanceId,
          }),
        );

        occurrenceDate = this.recurringScheduler.computeNextDate(
          occurrenceDate,
          schedule,
          dto.recurring.tz ?? 'Europe/Zurich',
        );
      }
    }

    const transaction = Transaction.create({
      id: this.idGenerator.generate(),
      userId,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      subcategory: dto.subcategory,
      type: dto.type,
      isForecasted: dto.isForecasted ?? false,
      amount,
      date: txDate,
      label: dto.label,
      note: dto.note,
    });

    await this.txRepo.save(transaction);

    for (const recurringTx of recurringForecastTransactions) {
      await this.txRepo.save(recurringTx);
    }

    if (recurringTemplate) {
      await this.recurringRepo.save(recurringTemplate);
    }

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

    const newAmount = dto.amount !== undefined
      ? Money.of(dto.amount, dto.currency ?? existing.amount.currency)
      : existing.amount;

    const newDate = dto.date ? new Date(dto.date) : existing.date;

    const updated = Transaction.create({
      id: existing.id,
      userId,
      accountId: existing.accountId,
      categoryId: dto.categoryId ?? existing.categoryId,
      subcategory: dto.subcategory !== undefined ? dto.subcategory : existing.subcategory,
      type: existing.type,
      isForecasted: dto.isForecasted ?? existing.isForecasted,
      amount: newAmount,
      date: newDate,
      label: dto.label ?? existing.label,
      note: dto.note ?? existing.note,
      recurringInstanceId: existing.recurringInstanceId,
    });

    await this.txRepo.save(updated);
    return updated;
  }

  async delete(userId: string, id: string): Promise<void> {
    const tx = await this.txRepo.findById(userId, id);
    if (!tx) throw new NotFoundError('Transaction', id);
    await this.txRepo.delete(userId, id);
  }

  async refreshForecast(userId: string): Promise<{ removedCount: number }> {
    const allTransactions = await this.txRepo.findByUser(userId, { limit: 5000 });

    const latestRealTransactionDate = allTransactions
      .filter((tx) => !tx.isForecasted)
      .reduce<Date | null>((latest, tx) => {
        if (!latest || tx.date > latest) {
          return tx.date;
        }
        return latest;
      }, null);

    if (!latestRealTransactionDate) {
      return { removedCount: 0 };
    }

    const obsoleteForecastTransactions = allTransactions.filter(
      (tx) => tx.isForecasted && tx.date <= latestRealTransactionDate,
    );

    for (const forecastTx of obsoleteForecastTransactions) {
      await this.txRepo.delete(userId, forecastTx.id);
    }

    return { removedCount: obsoleteForecastTransactions.length };
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
