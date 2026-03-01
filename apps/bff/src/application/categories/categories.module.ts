import { Module } from '@nestjs/common';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';
import { CATEGORY_REPOSITORY } from '../ports/CategoryRepository.js';
import { FirestoreCategoryRepository } from '../../infrastructure/adapters/firestore/FirestoreCategoryRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';

@Module({
  controllers: [CategoriesController],
  providers: [
    CategoriesService,
    { provide: CATEGORY_REPOSITORY, useClass: FirestoreCategoryRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [CategoriesService],
})
export class CategoriesModule {}
