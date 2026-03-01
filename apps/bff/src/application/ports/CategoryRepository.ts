import { Category, CategoryKind } from '@my-compta/domain';

export interface CategoryRepository {
  save(category: Category): Promise<void>;
  findById(userId: string, id: string): Promise<Category | null>;
  findAllByUser(userId: string, includeArchived?: boolean): Promise<Category[]>;
  findByKind(userId: string, kind: CategoryKind): Promise<Category[]>;
  delete(userId: string, id: string): Promise<void>;
}

export const CATEGORY_REPOSITORY = Symbol('CategoryRepository');
