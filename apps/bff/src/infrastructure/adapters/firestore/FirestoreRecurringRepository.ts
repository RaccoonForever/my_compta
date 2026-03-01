import { Inject, Injectable } from '@nestjs/common';
import {
  RecurringTemplate,
  RecurringTemplatePrimitives,
  RecurringStatus,
} from '@my-compta/domain';
import { RecurringRepository } from '../../../application/ports/RecurringRepository.js';
import { FIRESTORE } from './firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class FirestoreRecurringRepository implements RecurringRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('recurringTemplates');
  }

  private toPrimitives(
    id: string,
    data: admin.firestore.DocumentData,
  ): RecurringTemplatePrimitives {
    return {
      id,
      userId: data['userId'] as string,
      label: data['label'] as string,
      amount: data['amount'] as RecurringTemplatePrimitives['amount'],
      type: data['type'] as RecurringTemplatePrimitives['type'],
      categoryId: data['categoryId'] as string | undefined,
      accountId: data['accountId'] as string,
      schedule: data['schedule'] as RecurringTemplatePrimitives['schedule'],
      nextRunDate: (data['nextRunDate'] as admin.firestore.Timestamp).toDate(),
      status: data['status'] as RecurringStatus,
      tz: data['tz'] as string,
      createdAt: (data['createdAt'] as admin.firestore.Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as admin.firestore.Timestamp).toDate(),
    };
  }

  async save(template: RecurringTemplate): Promise<void> {
    await this.col().doc(template.id).set(template.toPrimitives());
  }

  async findById(userId: string, id: string): Promise<RecurringTemplate | null> {
    const doc = await this.col().doc(id).get();
    if (!doc.exists || doc.data()!['userId'] !== userId) return null;
    return RecurringTemplate.fromPrimitives(this.toPrimitives(doc.id, doc.data()!));
  }

  async findAllByUser(userId: string): Promise<RecurringTemplate[]> {
    const snap = await this.col().where('userId', '==', userId).get();
    return snap.docs.map(d =>
      RecurringTemplate.fromPrimitives(this.toPrimitives(d.id, d.data())),
    );
  }

  async findDue(now: Date): Promise<RecurringTemplate[]> {
    const snap = await this.col()
      .where('status', '==', 'active')
      .where('nextRunDate', '<=', now)
      .get();
    return snap.docs.map(d =>
      RecurringTemplate.fromPrimitives(this.toPrimitives(d.id, d.data())),
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    const doc = await this.col().doc(id).get();
    if (doc.exists && doc.data()!['userId'] === userId) {
      await this.col().doc(id).delete();
    }
  }
}
