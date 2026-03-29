import { Project } from '@my-compta/domain';

export interface ProjectRepository {
  save(project: Project): Promise<void>;
  findById(userId: string, id: string): Promise<Project | null>;
  findAllByUser(userId: string, includeArchived?: boolean): Promise<Project[]>;
  delete(userId: string, id: string): Promise<void>;
}

export const PROJECT_REPOSITORY = Symbol('ProjectRepository');
