import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Category, DEFAULT_CATEGORIES } from '@my-compta/domain';
import {
  CategoryRepository,
  CATEGORY_REPOSITORY,
} from '../ports/CategoryRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { CreateCategoryDto } from './dto/CreateCategoryDto.js';
import { UpdateCategoryDto } from './dto/UpdateCategoryDto.js';
import { NotFoundError } from '@my-compta/domain';
import { FIRESTORE } from '../../infrastructure/adapters/firestore/firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class CategoriesService {
  constructor(
    @Inject(CATEGORY_REPOSITORY)
    private readonly categoryRepo: CategoryRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(FIRESTORE)
    private readonly db: Firestore,
  ) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    const category = Category.create({
      id: this.idGenerator.generate(),
      userId,
      name: dto.name,
      kind: dto.kind,
      color: dto.color,
    });
    await this.categoryRepo.save(category);
    return category;
  }

  async list(userId: string, includeArchived = false): Promise<Category[]> {
    return this.categoryRepo.findAllByUser(userId, includeArchived);
  }

  async update(userId: string, id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryRepo.findById(userId, id);
    if (!category) throw new NotFoundError('Category', id);
    const updated = category.update(dto);
    await this.categoryRepo.save(updated);
    return updated;
  }

  async deleteCategory(userId: string, id: string): Promise<void> {
    const category = await this.categoryRepo.findById(userId, id);
    if (!category) throw new NotFoundError('Category', id);

    // Check for linked transactions (up to 6 to know if there are more than 5)
    const snap = await this.db
      .collection('transactions')
      .where('userId', '==', userId)
      .where('categoryId', '==', id)
      .limit(6)
      .get();

    if (!snap.empty) {
      const linked = snap.docs.slice(0, 5).map(doc => {
        const data = doc.data();
        const amount = data['amount'] as { value: number; currency: string };
        return {
          id: doc.id,
          label: data['label'] as string,
          amount: amount.value,
          currency: amount.currency,
          date: (data['date'] as admin.firestore.Timestamp).toDate().toISOString().slice(0, 10),
        };
      });
      throw new HttpException(
        {
          message: `This category is used by ${snap.size > 5 ? '5+' : snap.size} transaction(s) and cannot be deleted.`,
          transactions: linked,
          total: snap.size,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.categoryRepo.delete(userId, id);
  }

  /** Seeds default categories for a new user. Idempotent (skips existing). */
  async seedDefaults(userId: string): Promise<void> {
    const existing = await this.categoryRepo.findAllByUser(userId, true);
    if (existing.length > 0) return; // already seeded
    await Promise.all(
      DEFAULT_CATEGORIES.map(seed =>
        this.categoryRepo.save(
          Category.create({
            id: this.idGenerator.generate(),
            userId,
            ...seed,
          }),
        ),
      ),
    );
  }
}
