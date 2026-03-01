import { Module } from '@nestjs/common';
import { AccountsController } from './accounts.controller.js';
import { AccountsService } from './accounts.service.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';

@Module({
  controllers: [AccountsController],
  providers: [
    AccountsService,
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [AccountsService, ACCOUNT_REPOSITORY],
})
export class AccountsModule {}
