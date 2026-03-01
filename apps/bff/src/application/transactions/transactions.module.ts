import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [TransactionsService, TRANSACTION_REPOSITORY],
})
export class TransactionsModule {}
