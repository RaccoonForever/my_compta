import { Account } from '@my-compta/domain';

export interface AccountRepository {
  save(account: Account): Promise<void>;
  findById(userId: string, id: string): Promise<Account | null>;
  findAllByUser(userId: string, includeArchived?: boolean): Promise<Account[]>;
  delete(userId: string, id: string): Promise<void>;
}

export const ACCOUNT_REPOSITORY = Symbol('AccountRepository');
