import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@nestjs/swagger', () => ({
  ApiBearerAuth: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiPropertyOptional: () => () => undefined,
  ApiQuery: () => () => undefined,
  ApiTags: () => () => undefined,
}), { virtual: true });

import { Project } from '@my-compta/domain';
import { ProjectsController } from './projects.controller.js';

describe('ProjectsController', () => {
  let controller: ProjectsController;
  let projectsService: {
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    projectsService = {
      list: vi.fn().mockResolvedValue([
        Project.create({ id: 'proj-1', userId: 'user-1', name: 'Project 1' }),
      ]),
    };

    controller = new ProjectsController(projectsService as any);
  });

  it('parses includeArchived from string query value', async () => {
    const req = { user: { uid: 'user-1' } } as any;

    await controller.list(req, 'true');

    expect(projectsService.list).toHaveBeenCalledWith('user-1', true);
  });

  it('parses includeArchived from boolean query value', async () => {
    const req = { user: { uid: 'user-1' } } as any;

    await controller.list(req, true);

    expect(projectsService.list).toHaveBeenCalledWith('user-1', true);
  });
});
