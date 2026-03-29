import { Inject, Injectable } from '@nestjs/common';
import { Project, ProjectPrimitives } from '@my-compta/domain';
import { ProjectRepository } from '../../../application/ports/ProjectRepository.js';
import { FIRESTORE } from './firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

const toDate = (v: admin.firestore.Timestamp | Date): Date =>
  v instanceof Date ? v : v.toDate();

@Injectable()
export class FirestoreProjectRepository implements ProjectRepository {
  constructor(@Inject(FIRESTORE) private readonly db: Firestore) {}

  private col() {
    return this.db.collection('projects');
  }

  private toPrimitives(id: string, data: admin.firestore.DocumentData): ProjectPrimitives {
    return {
      id,
      userId: data['userId'] as string,
      name: data['name'] as string,
      description: data['description'] as string | undefined,
      color: data['color'] as string | undefined,
      isArchived: data['isArchived'] as boolean,
      createdAt: toDate(data['createdAt'] as admin.firestore.Timestamp),
      updatedAt: toDate(data['updatedAt'] as admin.firestore.Timestamp),
    };
  }

  async save(project: Project): Promise<void> {
    const p = project.toPrimitives();
    // Filter out undefined values to avoid Firestore errors
    const data: Record<string, unknown> = {
      userId: p.userId,
      name: p.name,
      isArchived: p.isArchived,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    };
    if (p.description !== undefined) data['description'] = p.description;
    if (p.color !== undefined) data['color'] = p.color;

    await this.col().doc(p.id).set(data);
  }

  async findById(userId: string, id: string): Promise<Project | null> {
    const doc = await this.col().doc(id).get();
    if (!doc.exists || doc.data()!['userId'] !== userId) return null;
    return Project.fromPrimitives(this.toPrimitives(doc.id, doc.data()!));
  }

  async findAllByUser(userId: string, includeArchived = false): Promise<Project[]> {
    let q = this.col().where('userId', '==', userId) as admin.firestore.Query;
    if (!includeArchived) q = q.where('isArchived', '==', false);
    const snap = await q.get();
    return snap.docs.map(d => Project.fromPrimitives(this.toPrimitives(d.id, d.data())));
  }

  async delete(userId: string, id: string): Promise<void> {
    const doc = await this.col().doc(id).get();
    if (doc.exists && doc.data()!['userId'] === userId) {
      await this.col().doc(id).delete();
    }
  }
}
