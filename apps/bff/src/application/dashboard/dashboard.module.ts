import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';
import { AccountsModule } from '../accounts/accounts.module.js';
import { ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { FirestoreAccountRepository } from '../../infrastructure/adapters/firestore/FirestoreAccountRepository.js';

@Module({
  imports: [AccountsModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    { provide: ACCOUNT_REPOSITORY, useClass: FirestoreAccountRepository },
  ],
})
export class DashboardModule {}
