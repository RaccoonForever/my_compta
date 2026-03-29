import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller.js';
import { ProjectsService } from './projects.service.js';
import { PROJECT_REPOSITORY } from '../ports/ProjectRepository.js';
import { FirestoreProjectRepository } from '../../infrastructure/adapters/firestore/FirestoreProjectRepository.js';
import { ID_GENERATOR, UuidGenerator } from '../ports/IdGenerator.js';

@Module({
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    { provide: PROJECT_REPOSITORY, useClass: FirestoreProjectRepository },
    { provide: ID_GENERATOR, useClass: UuidGenerator },
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
