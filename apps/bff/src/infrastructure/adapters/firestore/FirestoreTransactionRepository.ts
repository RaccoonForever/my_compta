import { Inject, Injectable } from '@nestjs/common';
import {
  Transaction,
  TransactionPrimitives,
  TransactionType,
} from '@my-compta/domain';
import {
  TransactionRepository,
  TransactionFilters,
} from '../../../application/ports/TransactionRepository.js';
import { FIRESTORE } from './firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class FirestoreTransactionRepository implements TransactionRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('transactions');
  }

  private toPrimitives(
    id: string,
    data: admin.firestore.DocumentData,
  ): TransactionPrimitives {
    return {
      id,
      userId: data['userId'] as string,
      accountId: data['accountId'] as string,
      categoryId: data['categoryId'] as string | undefined,
      type: data['type'] as TransactionType,
      amount: data['amount'] as TransactionPrimitives['amount'],
      date: (data['date'] as admin.firestore.Timestamp).toDate(),
      label: data['label'] as string,
      note: data['note'] as string | undefined,
      transferLinkId: data['transferLinkId'] as string | undefined,
      recurringInstanceId: data['recurringInstanceId'] as string | undefined,
      createdAt: (data['createdAt'] as admin.firestore.Timestamp).toDate(),
      updatedAt: (data['updatedAt'] as admin.firestore.Timestamp).toDate(),
    };
  }

  async save(transaction: Transaction): Promise<void> {
    await this.col().doc(transaction.id).set(transaction.toPrimitives());
  }

  async saveBatch(transactions: Transaction[]): Promise<void> {
    const batch = this.db.batch();
    for (const tx of transactions) {
      batch.set(this.col().doc(tx.id), tx.toPrimitives());
    }
    await batch.commit();
  }

  async findById(userId: string, id: string): Promise<Transaction | null> {
    const doc = await this.col().doc(id).get();
    if (!doc.exists || doc.data()!['userId'] !== userId) return null;
    return Transaction.fromPrimitives(this.toPrimitives(doc.id, doc.data()!));
  }

  async findByUser(
    userId: string,
    filters: TransactionFilters = {},
  ): Promise<Transaction[]> {
    let q = this.col().where('userId', '==', userId) as admin.firestore.Query;
    if (filters.accountId) q = q.where('accountId', '==', filters.accountId);
    if (filters.categoryId) q = q.where('categoryId', '==', filters.categoryId);
    if (filters.type) q = q.where('type', '==', filters.type);
    if (filters.from) q = q.where('date', '>=', filters.from);
    if (filters.to) q = q.where('date', '<=', filters.to);
    q = q.orderBy('date', 'desc');
    if (filters.limit) q = q.limit(filters.limit);
    if (filters.afterId) {
      const cursor = await this.col().doc(filters.afterId).get();
      if (cursor.exists) q = q.startAfter(cursor);
    }
    const snap = await q.get();
    return snap.docs.map(d =>
      Transaction.fromPrimitives(this.toPrimitives(d.id, d.data())),
    );
  }

  async findByTransferLinkId(
    userId: string,
    transferLinkId: string,
  ): Promise<Transaction[]> {
    const snap = await this.col()
      .where('userId', '==', userId)
      .where('transferLinkId', '==', transferLinkId)
      .get();
    return snap.docs.map(d =>
      Transaction.fromPrimitives(this.toPrimitives(d.id, d.data())),
    );
  }

  async delete(userId: string, id: string): Promise<void> {
    const doc = await this.col().doc(id).get();
    if (doc.exists && doc.data()!['userId'] === userId) {
      await this.col().doc(id).delete();
    }
  }
}
