import { Inject, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { Project, NotFoundError } from '@my-compta/domain';
import {
  ProjectRepository,
  PROJECT_REPOSITORY,
} from '../ports/ProjectRepository.js';
import { IdGenerator, ID_GENERATOR } from '../ports/IdGenerator.js';
import { CreateProjectDto } from './dto/CreateProjectDto.js';
import { UpdateProjectDto } from './dto/UpdateProjectDto.js';
import { FIRESTORE } from '../../infrastructure/adapters/firestore/firebase.module.js';
import type * as admin from 'firebase-admin';

type Firestore = admin.firestore.Firestore;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepo: ProjectRepository,
    @Inject(ID_GENERATOR)
    private readonly idGenerator: IdGenerator,
    @Inject(FIRESTORE)
    private readonly db: Firestore,
  ) {}

  async create(userId: string, dto: CreateProjectDto): Promise<Project> {
    const project = Project.create({
      id: this.idGenerator.generate(),
      userId,
      name: dto.name,
      description: dto.description,
      color: dto.color,
    });
    await this.projectRepo.save(project);
    return project;
  }

  async list(userId: string, includeArchived = false): Promise<Project[]> {
    return this.projectRepo.findAllByUser(userId, includeArchived);
  }

  async update(userId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
    const project = await this.projectRepo.findById(userId, id);
    if (!project) throw new NotFoundError('Project', id);

    const current = project.toPrimitives();
    const nextArchived =
      dto.isArchived !== undefined ? dto.isArchived : current.isArchived;

    const updatedProject = Project.fromPrimitives({
      ...current,
      name: dto.name ?? current.name,
      description: dto.description ?? current.description,
      color: dto.color ?? current.color,
      isArchived: nextArchived,
      updatedAt: new Date(),
    });

    await this.projectRepo.save(updatedProject);
    return updatedProject;
  }

  async deleteProject(userId: string, id: string): Promise<void> {
    const project = await this.projectRepo.findById(userId, id);
    if (!project) throw new NotFoundError('Project', id);

    // Check for linked transactions (up to 6 to know if there are more than 5)
    const snap = await this.db
      .collection('transactions')
      .where('userId', '==', userId)
      .where('projectIds', 'array-contains', id)
      .limit(6)
      .get();

    if (!snap.empty) {
      const linked = snap.docs.slice(0, 5).map((doc: admin.firestore.QueryDocumentSnapshot) => {
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
          message: `This project is used by ${snap.size > 5 ? '5+' : snap.size} transaction(s) and cannot be deleted.`,
          transactions: linked,
          total: snap.size,
        },
        HttpStatus.CONFLICT,
      );
    }

    await this.projectRepo.delete(userId, id);
  }
}
