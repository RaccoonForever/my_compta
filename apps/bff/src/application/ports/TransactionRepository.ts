import { Transaction, TransactionType } from '@my-compta/domain';

export interface TransactionFilters {
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  from?: Date;
  to?: Date;
  /** Cursor-based pagination */
  afterId?: string;
  limit?: number;
}

export interface TransactionRepository {
  save(transaction: Transaction): Promise<void>;
  saveBatch(transactions: Transaction[]): Promise<void>;
  findById(userId: string, id: string): Promise<Transaction | null>;
  findByUser(userId: string, filters?: TransactionFilters): Promise<Transaction[]>;
  findByTransferLinkId(userId: string, transferLinkId: string): Promise<Transaction[]>;
  delete(userId: string, id: string): Promise<void>;
}

export const TRANSACTION_REPOSITORY = Symbol('TransactionRepository');
