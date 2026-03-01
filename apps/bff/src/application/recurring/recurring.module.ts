import { Module } from '@nestjs/common';
import { RecurringController } from './recurring.controller.js';
import { RecurringService } from './recurring.service.js';
import { RECURRING_REPOSITORY } from '../ports/RecurringRepository.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { FirestoreRecurringRepository } from '../../infrastructure/adapters/firestore/FirestoreRecurringRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';
import { CLOCK, SystemClock } from '../ports/Clock.js';

@Module({
  controllers: [RecurringController],
  providers: [
    RecurringService,
    { provide: RECURRING_REPOSITORY, useClass: FirestoreRecurringRepository },
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [RecurringService, RECURRING_REPOSITORY],
})
export class RecurringModule {}
