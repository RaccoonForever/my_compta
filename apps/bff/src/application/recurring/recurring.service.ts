import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  Money,
  RecurringTemplate,
  Transaction,
  NotFoundError,
} from '@my-compta/domain';
import { RecurringSchedulerService } from '@my-compta/domain';
import {
  RecurringRepository,
  RECURRING_REPOSITORY,
} from '../ports/RecurringRepository.js';
import { AccountRepository, ACCOUNT_REPOSITORY } from '../ports/AccountRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { Clock, CLOCK } from '../ports/Clock.js';
import { CreateRecurringTemplateDto } from './dto/CreateRecurringTemplateDto.js';
import { FIRESTORE } from '../../infrastructure/adapters/firestore/firebase.module.js';
import * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);
  private readonly scheduler = new RecurringSchedulerService();

  constructor(
    @Inject(RECURRING_REPOSITORY)
    private readonly recurringRepo: RecurringRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepo: AccountRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(CLOCK)
    private readonly clock: Clock,
    @Inject(FIRESTORE)
    private readonly db: Firestore,
  ) {}

  async create(userId: string, dto: CreateRecurringTemplateDto): Promise<RecurringTemplate> {
    const template = RecurringTemplate.create({
      id: this.idGenerator.generate(),
      userId,
      label: dto.label,
      amount: { value: dto.amount, currency: dto.currency },
      type: dto.type,
      categoryId: dto.categoryId,
      accountId: dto.accountId,
      schedule: dto.schedule,
      nextRunDate: new Date(dto.nextRunDate),
      tz: dto.tz,
    });
    await this.recurringRepo.save(template);
    return template;
  }

  async list(userId: string): Promise<RecurringTemplate[]> {
    return this.recurringRepo.findAllByUser(userId);
  }

  async pause(userId: string, id: string): Promise<RecurringTemplate> {
    const template = await this.recurringRepo.findById(userId, id);
    if (!template) throw new NotFoundError('RecurringTemplate', id);
    const paused = template.pause();
    await this.recurringRepo.save(paused);
    return paused;
  }

  async resume(userId: string, id: string): Promise<RecurringTemplate> {
    const template = await this.recurringRepo.findById(userId, id);
    if (!template) throw new NotFoundError('RecurringTemplate', id);
    const resumed = template.resume();
    await this.recurringRepo.save(resumed);
    return resumed;
  }

  async delete(userId: string, id: string): Promise<void> {
    const template = await this.recurringRepo.findById(userId, id);
    if (!template) throw new NotFoundError('RecurringTemplate', id);
    await this.recurringRepo.delete(userId, id);
  }

  /**
   * Run all due recurring templates.
   * Called by the scheduler (Cloud Scheduler in prod, or manually in dev).
   * TECHNICAL.md: Idempotency key = (templateId, scheduledDate).
   */
  async runDue(): Promise<{ processed: number; skipped: number }> {
    const now = this.clock.now();
    const dueTemplates = await this.recurringRepo.findDue(now);
    let processed = 0;
    let skipped = 0;

    for (const template of dueTemplates) {
      try {
        const result = await this.postInstance(template, now);
        if (result === 'processed') processed++;
        else skipped++;
      } catch (err) {
        this.logger.error(`Failed to process template ${template.id}`, err);
      }
    }

    return { processed, skipped };
  }

  private async postInstance(
    template: RecurringTemplate,
    now: Date,
  ): Promise<'processed' | 'skipped'> {
    const instanceId = this.scheduler.instanceKey(template.id, template.nextRunDate);

    // Idempotency: check if this instance was already created
    const existing = await this.db
      .collection('transactions')
      .where('recurringInstanceId', '==', instanceId)
      .get();

    if (!existing.empty) {
      this.logger.log(`Skipping duplicate instance: ${instanceId}`);
      // Still advance nextRunDate if needed
    } else {
      const account = await this.accountRepo.findById(template.userId, template.accountId);
      if (!account) {
        this.logger.warn(`Account ${template.accountId} not found, skipping`);
        return 'skipped';
      }

      const amount = Money.of(template.amount.value, template.amount.currency);
      const signedDelta = template.type === 'income' ? amount.value : -amount.value;

      const transaction = Transaction.create({
        id: this.idGenerator.generate(),
        userId: template.userId,
        accountId: template.accountId,
        categoryId: template.categoryId,
        type: template.type,
        amount,
        date: template.nextRunDate,
        label: template.label,
        recurringInstanceId: instanceId,
      });

      const batch = this.db.batch();
      batch.set(
        this.db.collection('transactions').doc(transaction.id),
        transaction.toPrimitives(),
      );
      batch.update(this.db.collection('accounts').doc(template.accountId), {
        balance: admin.firestore.FieldValue.increment(signedDelta),
        updatedAt: now,
      });

      // Advance nextRunDate
      const nextDate = this.scheduler.computeNextDate(
        template.nextRunDate,
        template.schedule,
        template.tz,
      );
      batch.update(
        this.db.collection('recurringTemplates').doc(template.id),
        { nextRunDate: nextDate, updatedAt: now },
      );

      await batch.commit();
    }

    return 'processed';
  }
}
