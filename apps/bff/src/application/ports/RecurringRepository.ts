import { RecurringTemplate } from '@my-compta/domain';

export interface RecurringRepository {
  save(template: RecurringTemplate): Promise<void>;
  findById(userId: string, id: string): Promise<RecurringTemplate | null>;
  findAllByUser(userId: string): Promise<RecurringTemplate[]>;
  /** Find all active templates with nextRunDate <= now (for the scheduler). */
  findDue(now: Date): Promise<RecurringTemplate[]>;
  delete(userId: string, id: string): Promise<void>;
}

export const RECURRING_REPOSITORY = Symbol('RecurringRepository');
