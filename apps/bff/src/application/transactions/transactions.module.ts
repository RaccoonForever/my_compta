import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller.js';
import { TransactionsService } from './transactions.service.js';
import { TransactionImportService } from './transaction-import.service.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { CATEGORY_REPOSITORY } from '../ports/CategoryRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';
import { FirestoreCategoryRepository } from '../../infrastructure/adapters/firestore/FirestoreCategoryRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';
import { CsvParserService } from '../../infrastructure/adapters/csv/CsvParserService.js';

@Module({
  controllers: [TransactionsController],
  providers: [
    TransactionsService,
    TransactionImportService,
    CsvParserService,
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
    { provide: CATEGORY_REPOSITORY, useClass: FirestoreCategoryRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [TransactionsService, TransactionImportService, TRANSACTION_REPOSITORY],
})
export class TransactionsModule {}
