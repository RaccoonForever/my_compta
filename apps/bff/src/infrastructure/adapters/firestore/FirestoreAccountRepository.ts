import { Inject, Injectable } from '@nestjs/common';
import { Account, AccountPrimitives, AccountType } from '@my-compta/domain';
import { AccountRepository } from '../../../application/ports/AccountRepository.js';
import { FIRESTORE } from './firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class FirestoreAccountRepository implements AccountRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('accounts');
  }

  private toPrimitives(id: string, data: admin.firestore.DocumentData): AccountPrimitives {
    return {
      id,
      userId: data['userId'] as string,
      name: data['name'] as string,
      type: data['type'] as AccountType,
      currency: data['currency'] as AccountPrimitives['currency'],
      balance: data['balance'] as number,
      isArchived: data['isArchived'] as boolean,
      createdAt: (data['createdAt'] as admin.firestore.Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as admin.firestore.Timestamp).toDate(),
    };
  }

  async save(account: Account): Promise<void> {
    await this.col().doc(account.id).set(account.toPrimitives());
  }

  async findById(userId: string, id: string): Promise<Account | null> {
    const doc = await this.col().doc(id).get();
    if (!doc.exists || doc.data()!['userId'] !== userId) return null;
    return Account.fromPrimitives(this.toPrimitives(doc.id, doc.data()!));
  }

  async findAllByUser(userId: string, includeArchived = false): Promise<Account[]> {
    let q = this.col().where('userId', '==', userId) as admin.firestore.Query;
    if (!includeArchived) q = q.where('isArchived', '==', false);
    const snap = await q.get();
    return snap.docs.map(d => Account.fromPrimitives(this.toPrimitives(d.id, d.data())));
  }

  async delete(userId: string, id: string): Promise<void> {
    const doc = await this.col().doc(id).get();
    if (doc.exists && doc.data()!['userId'] === userId) {
      await this.col().doc(id).delete();
    }
  }

  /** Apply a balance delta atomically (used during transaction creation/deletion). */
  applyDeltaRef(
    id: string,
    delta: number,
  ): { ref: admin.firestore.DocumentReference; delta: number } {
    return { ref: this.col().doc(id), delta };
  }
}
