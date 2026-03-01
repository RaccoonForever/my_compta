import { Module, Global } from '@nestjs/common';
import { FirebaseModule } from './adapters/firestore/firebase.module.js';
import { CategoriesModule } from '../application/categories/categories.module.js';
import { AccountsModule } from '../application/accounts/accounts.module.js';
import { TransactionsModule } from '../application/transactions/transactions.module.js';
import { RecurringModule } from '../application/recurring/recurring.module.js';
import { DashboardModule } from '../application/dashboard/dashboard.module.js';
import { AnalyticsModule } from '../application/analytics/analytics.module.js';
import { SettingsModule } from '../application/settings/settings.module.js';

@Global()
@Module({
  imports: [
    FirebaseModule,
    CategoriesModule,
    AccountsModule,
    TransactionsModule,
    RecurringModule,
    DashboardModule,
    AnalyticsModule,
    SettingsModule,
  ],
  exports: [FirebaseModule],
})
export class InfrastructureModule {}
