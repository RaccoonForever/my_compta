import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../infrastructure/http/guards/AuthGuard.js';
import { ProjectsService } from './projects.service.js';
import { CreateProjectDto } from './dto/CreateProjectDto.js';
import { UpdateProjectDto } from './dto/UpdateProjectDto.js';
import { ProjectResponseDto } from './dto/ProjectResponseDto.js';

interface AuthRequest {
  user: { uid: string };
}

const parseIncludeArchived = (value?: string | boolean): boolean => {
  if (typeof value === 'boolean') return value;
  return value === 'true';
};

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a project' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.create(req.user.uid, dto);
    return project.toPrimitives();
  }

  @Get()
  @ApiOperation({ summary: 'List projects' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async list(
    @Request() req: AuthRequest,
    @Query('includeArchived') includeArchived?: string | boolean,
  ): Promise<ProjectResponseDto[]> {
    const projects = await this.projectsService.list(
      req.user.uid,
      parseIncludeArchived(includeArchived),
    );
    return projects.map(p => p.toPrimitives());
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a project' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const project = await this.projectsService.update(req.user.uid, id, dto);
    return project.toPrimitives();
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hard delete a project (fails if transactions linked)' })
  async delete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.projectsService.deleteProject(req.user.uid, id);
  }
}
