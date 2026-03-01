import { Inject, Injectable } from '@nestjs/common';
import { Account, NotFoundError } from '@my-compta/domain';
import { AccountRepository, ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { CreateAccountDto } from './dto/CreateAccountDto.js';
import { UpdateAccountDto } from './dto/UpdateAccountDto.js';

@Injectable()
export class AccountsService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY) private readonly accountRepo: AccountRepository,
    @Inject(ID_GENERATOR) private readonly idGenerator: IdGenerator,
  ) {}

  async create(userId: string, dto: CreateAccountDto): Promise<Account> {
    const account = Account.create({
      id: this.idGenerator.generate(),
      userId,
      name: dto.name,
      type: dto.type,
      currency: dto.currency,
      balance: dto.balance ?? 0,
      createdAt: dto.createdAt ? new Date(dto.createdAt) : undefined,
    });
    await this.accountRepo.save(account);
    return account;
  }

  async list(userId: string, includeArchived = false): Promise<Account[]> {
    return this.accountRepo.findAllByUser(userId, includeArchived);
  }

  async findById(userId: string, id: string): Promise<Account> {
    const account = await this.accountRepo.findById(userId, id);
    if (!account) throw new NotFoundError('Account', id);
    return account;
  }

  async update(userId: string, id: string, dto: UpdateAccountDto): Promise<Account> {
    const account = await this.accountRepo.findById(userId, id);
    if (!account) throw new NotFoundError('Account', id);
    const updated = account.update(dto);
    await this.accountRepo.save(updated);
    return updated;
  }

  async archive(userId: string, id: string): Promise<Account> {
    const account = await this.accountRepo.findById(userId, id);
    if (!account) throw new NotFoundError('Account', id);
    const archived = account.archive();
    await this.accountRepo.save(archived);
    return archived;
  }

}

