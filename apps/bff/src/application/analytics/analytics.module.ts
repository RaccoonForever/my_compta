import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { TRANSACTION_REPOSITORY } from '../ports/TransactionRepository.js';
import { FirestoreTransactionRepository } from '../../infrastructure/adapters/firestore/FirestoreTransactionRepository.js';

@Module({
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    { provide: TRANSACTION_REPOSITORY, useClass: FirestoreTransactionRepository },
  ],
})
export class AnalyticsModule {}
