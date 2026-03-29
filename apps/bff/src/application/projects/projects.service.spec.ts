import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpException } from '@nestjs/common';
import { NotFoundError, Project } from '@my-compta/domain';
import { ProjectsService } from './projects.service.js';

function makeProjectRepo() {
  return {
    save: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findAllByUser: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

function makeIdGenerator(id = 'generated-id') {
  return { generate: vi.fn().mockReturnValue(id) };
}

function makeFirestore() {
  const get = vi.fn();
  const limit = vi.fn().mockReturnValue({ get });
  const where2 = vi.fn().mockReturnValue({ limit });
  const where1 = vi.fn().mockReturnValue({ where: where2 });
  const collection = vi.fn().mockReturnValue({ where: where1 });

  return {
    collection,
    __mocks: { get, limit, where1, where2 },
  };
}

describe('ProjectsService', () => {
  let service: ProjectsService;
  let projectRepo: ReturnType<typeof makeProjectRepo>;
  let idGenerator: ReturnType<typeof makeIdGenerator>;
  let db: ReturnType<typeof makeFirestore>;

  beforeEach(() => {
    projectRepo = makeProjectRepo();
    idGenerator = makeIdGenerator('proj-1');
    db = makeFirestore();

    service = new ProjectsService(
      projectRepo as any,
      idGenerator as any,
      db as any,
    );
  });

  it('creates and saves a project', async () => {
    const created = await service.create('user-1', {
      name: 'Flat renovation',
      description: 'Main renovation project',
      color: '#22c55e',
    });

    expect(created.name).toBe('Flat renovation');
    expect(created.userId).toBe('user-1');
    expect(projectRepo.save).toHaveBeenCalledWith(created);
  });

  it('lists projects for user', async () => {
    const project = Project.create({ id: 'p-1', userId: 'user-1', name: 'P1' });
    projectRepo.findAllByUser.mockResolvedValue([project]);

    const result = await service.list('user-1', false);

    expect(result).toEqual([project]);
    expect(projectRepo.findAllByUser).toHaveBeenCalledWith('user-1', false);
  });

  it('updates project fields while preserving createdAt', async () => {
    const createdAt = new Date('2025-01-01T00:00:00.000Z');
    const updatedAt = new Date('2025-01-05T00:00:00.000Z');

    projectRepo.findById.mockResolvedValue(
      Project.fromPrimitives({
        id: 'p-1',
        userId: 'user-1',
        name: 'Old name',
        description: 'Old description',
        color: '#111111',
        isArchived: false,
        createdAt,
        updatedAt,
      }),
    );

    const updated = await service.update('user-1', 'p-1', {
      name: 'New name',
      isArchived: true,
    });

    expect(updated.name).toBe('New name');
    expect(updated.createdAt.toISOString()).toBe(createdAt.toISOString());
    expect(updated.isArchived).toBe(true);
    expect(projectRepo.save).toHaveBeenCalledWith(updated);
  });

  it('throws NotFoundError when updating missing project', async () => {
    projectRepo.findById.mockResolvedValue(null);

    await expect(service.update('user-1', 'missing', { name: 'X' })).rejects.toThrow(NotFoundError);
  });

  it('throws conflict when deleting a linked project', async () => {
    projectRepo.findById.mockResolvedValue(
      Project.create({ id: 'p-1', userId: 'user-1', name: 'To delete' }),
    );

    db.__mocks.get.mockResolvedValue({
      empty: false,
      size: 1,
      docs: [
        {
          id: 'tx-1',
          data: () => ({
            label: 'Expense',
            amount: { value: 120, currency: 'CHF' },
            date: { toDate: () => new Date('2026-01-01T00:00:00.000Z') },
          }),
        },
      ],
    });

    await expect(service.deleteProject('user-1', 'p-1')).rejects.toBeInstanceOf(HttpException);
    expect(projectRepo.delete).not.toHaveBeenCalled();
  });

  it('deletes project when no linked transactions exist', async () => {
    projectRepo.findById.mockResolvedValue(
      Project.create({ id: 'p-1', userId: 'user-1', name: 'To delete' }),
    );

    db.__mocks.get.mockResolvedValue({
      empty: true,
      size: 0,
      docs: [],
    });

    await service.deleteProject('user-1', 'p-1');

    expect(projectRepo.delete).toHaveBeenCalledWith('user-1', 'p-1');
  });
});
