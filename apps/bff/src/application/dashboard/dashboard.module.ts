import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { RECURRING_REPOSITORY } from '../ports/RecurringRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';
import { FirestoreRecurringRepository } from '../../infrastructure/adapters/firestore/FirestoreRecurringRepository.js';

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
    { provide: RECURRING_REPOSITORY, useClass: FirestoreRecurringRepository },
  ],
})
export class DashboardModule {}
