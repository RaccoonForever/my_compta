import { Inject, Injectable } from '@nestjs/common';
import { Category, CategoryKind, CategoryPrimitives } from '@my-compta/domain';
import { CategoryRepository } from '../../../application/ports/CategoryRepository.js';
import { FIRESTORE } from './firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

const toDate = (v: admin.firestore.Timestamp | Date): Date =>
  v instanceof Date ? v : v.toDate();

@Injectable()
export class FirestoreCategoryRepository implements CategoryRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('categories');
  }

  private toPrimitives(id: string, data: admin.firestore.DocumentData): CategoryPrimitives {
    return {
      id,
      userId: data['userId'] as string,
      name: data['name'] as string,
      kind: data['kind'] as CategoryKind,
      color: data['color'] as string | undefined,
      isArchived: data['isArchived'] as boolean,
      createdAt: toDate(data['createdAt'] as admin.firestore.Timestamp),
    };
  }

  async save(category: Category): Promise<void> {
    const p = category.toPrimitives();
    await this.col().doc(p.id).set({
      ...p,
      createdAt: p.createdAt,
    });
  }

  async findById(userId: string, id: string): Promise<Category | null> {
    const doc = await this.col().doc(id).get();
    if (!doc.exists || doc.data()!['userId'] !== userId) return null;
    return Category.fromPrimitives(this.toPrimitives(doc.id, doc.data()!));
  }

  async findAllByUser(userId: string, includeArchived = false): Promise<Category[]> {
    let q = this.col().where('userId', '==', userId) as admin.firestore.Query;
    if (!includeArchived) q = q.where('isArchived', '==', false);
    const snap = await q.get();
    return snap.docs.map(d => Category.fromPrimitives(this.toPrimitives(d.id, d.data())));
  }

  async findByKind(userId: string, kind: CategoryKind): Promise<Category[]> {
    const snap = await this.col()
      .where('userId', '==', userId)
      .where('kind', '==', kind)
      .where('isArchived', '==', false)
      .get();
    return snap.docs.map(d => Category.fromPrimitives(this.toPrimitives(d.id, d.data())));
  }

  async delete(userId: string, id: string): Promise<void> {
    const doc = await this.col().doc(id).get();
    if (doc.exists && doc.data()!['userId'] === userId) {
      await this.col().doc(id).delete();
    }
  }
}
