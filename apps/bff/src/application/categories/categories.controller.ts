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
import { CategoriesService } from './categories.service.js';
import { CategoryImportService } from './category-import.service.js';
import { CreateCategoryDto } from './dto/CreateCategoryDto.js';
import { UpdateCategoryDto } from './dto/UpdateCategoryDto.js';
import { CategoryResponseDto } from './dto/CategoryResponseDto.js';
import { CategoryImportSummary, ImportCategoryRow, ConfirmCategoryImportResponse } from './dto/ImportCategoryDto.js';

interface AuthRequest {
  user: { uid: string };
}

@ApiTags('categories')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly importService: CategoryImportService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  async create(
    @Request() req: AuthRequest,
    @Body() dto: CreateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.create(req.user.uid, dto);
    return CategoryResponseDto.from(category.toPrimitives());
  }

  @Get()
  @ApiOperation({ summary: 'List categories' })
  @ApiQuery({ name: 'includeArchived', required: false, type: Boolean })
  async list(
    @Request() req: AuthRequest,
    @Query('includeArchived') includeArchived?: string,
  ): Promise<CategoryResponseDto[]> {
    const categories = await this.categoriesService.list(
      req.user.uid,
      includeArchived === 'true',
    );
    return categories.map(c => CategoryResponseDto.from(c.toPrimitives()));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a category' })
  async update(
    @Request() req: AuthRequest,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryResponseDto> {
    const category = await this.categoriesService.update(req.user.uid, id, dto);
    return CategoryResponseDto.from(category.toPrimitives());
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Hard delete a category (fails if transactions linked)' })
  async delete(
    @Request() req: AuthRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.categoriesService.deleteCategory(req.user.uid, id);
  }

  @Post('seed-defaults')
  @ApiOperation({ summary: 'Seed default categories for a new user' })
  async seedDefaults(@Request() req: AuthRequest): Promise<{ seeded: boolean }> {
    await this.categoriesService.seedDefaults(req.user.uid);
    return { seeded: true };
  }

  @Post('import/extract')
  @ApiOperation({
    summary: 'Extract categories from transaction CSV for review',
  })
  async extractCategories(
    @Request() req: AuthRequest,
    @Body() dto: { csv: string },
  ): Promise<CategoryImportSummary> {
    // Get existing categories to check for duplicates
    const existingCategories = await this.categoriesService.list(req.user.uid, false);
    const primitives = existingCategories.map(c => c.toPrimitives());

    // Extract and validate
    const summary = await this.importService.extractCategoriesFromCSV(
      dto.csv,
      primitives,
    );

    return summary;
  }

  @Post('import/confirm')
  @ApiOperation({
    summary: 'Confirm and save imported categories/subcategories',
  })
  async confirmCategoryImport(
    @Request() req: AuthRequest,
    @Body() dto: { rows: ImportCategoryRow[] },
  ): Promise<ConfirmCategoryImportResponse> {
    return this.importService.confirmCategoryImport(req.user.uid, dto.rows);
  }
}
