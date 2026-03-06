import { Injectable } from '@nestjs/common';
import { TransactionImportService } from '../transactions/transaction-import.service';
import { CategoriesService } from './categories.service';
import {
  CategoryImportSummary,
  ImportCategoryRow,
  ImportCategoryPair,
  ConfirmCategoryImportResponse,
} from './dto/ImportCategoryDto';
import { CategoryPrimitives } from '@my-compta/domain';

@Injectable()
export class CategoryImportService {
  constructor(
    private transactionImportService: TransactionImportService,
    private categoriesService: CategoriesService,
  ) {}

  /**
   * Extract unique category/subcategory pairs from a transaction CSV
   * Returns summary for user review and editing
   */
  async extractCategoriesFromCSV(
    csvContent: string,
    existingCategories: CategoryPrimitives[],
  ): Promise<CategoryImportSummary> {
    // Parse CSV using transaction import service
    const transactionSummary = await this.transactionImportService.parseAndValidateCsv(
      csvContent,
    );

    // Extract category/subcategory pairs from successful transactions
    const pairs = new Map<string, ImportCategoryPair>();

    for (const result of transactionSummary.results) {
      if (result.success && result.transaction) {
        const tx = result.transaction;

        const resolvedCategory = this.resolveImportedCategoryName(
          tx.category,
          tx.operationType,
        );

        if (!resolvedCategory) {
          continue;
        }

        const sanitizedSubcategory = this.sanitizeImportedLabel(tx.subcategory);

        const key = `${tx.type}:${resolvedCategory}:${sanitizedSubcategory || ''}`;

        if (pairs.has(key)) {
          const existing = pairs.get(key)!;
          pairs.set(key, { ...existing, count: existing.count + 1 });
        } else {
          pairs.set(key, {
            category: resolvedCategory,
            subcategory: sanitizedSubcategory,
            kind: tx.type === 'income' ? 'income' : 'expense',
            count: 1,
          });
        }
      }
    }

    // Convert to rows for UI
    const rows: ImportCategoryRow[] = Array.from(pairs.values()).map((pair, index) => {
      const existingCategory = existingCategories.find(
        c => c.name.toLowerCase() === pair.category.toLowerCase() && c.kind === pair.kind,
      );

      const alreadyExists = !!existingCategory;
      const warnings: string[] = [];
      let subcategoryExists = false;
      let pairExists = false;

      // Check if subcategory already exists
      if (pair.subcategory && existingCategory) {
        const hasSubcategory = existingCategory.subcategories?.some(
          s => s.toLowerCase() === pair.subcategory!.toLowerCase(),
        );
        if (hasSubcategory) {
          subcategoryExists = true;
          pairExists = true;
          warnings.push('Subcategory already exists');
        }
      } else if (!pair.subcategory && existingCategory) {
        // Category without subcategory - if category exists, the pair exists
        pairExists = true;
      }

      // Warn if category name is very long
      if (pair.category.length > 50) {
        warnings.push('Category name is very long - consider shortening');
      }

      return {
        rowNumber: index + 1,
        category: pair.category,
        subcategory: pair.subcategory,
        kind: pair.kind,
        occurrences: pair.count,
        alreadyExists,
        pairExists,
        subcategoryExists: pair.subcategory ? subcategoryExists : undefined,
        selected: true, // Selected by default
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    });

    // Sort by kind, then category name
    rows.sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'income' ? -1 : 1;
      }
      return a.category.localeCompare(b.category);
    });

    // Calculate grouped summary
    const groupedByCategory = this.groupByCategory(rows);

    // Calculate counts:
    // - New categories = unique new category names (categories that don't exist in system)
    // - Existing pairs = pairs (category + subcategory combo) that already exist
    // - New subcategories = subcategories that will be added (not already existing)
    const newCategoriesSet = new Set<string>();
    let existingPairsCount = 0;
    let newSubcategoriesCount = 0;

    for (const row of rows) {
      if (!row.selected) continue;

      // Count existing pairs
      if (row.pairExists) {
        existingPairsCount++;
      }

      // Count new subcategories (only those that don't already exist)
      if (row.subcategory && !row.subcategoryExists) {
        newSubcategoriesCount++;
      }

      // Count new categories (only those that don't exist at all)
      if (!row.alreadyExists) {
        newCategoriesSet.add(`${row.kind}:${row.category}`);
      }
    }

    return {
      totalPairs: rows.length,
      newCategoriesCount: newCategoriesSet.size,
      existingPairsCount,
      newSubcategoriesCount,
      rows,
      groupedByCategory,
    };
  }

  /**
   * Group rows by category for summary view
   */
  private groupByCategory(
    rows: ImportCategoryRow[],
  ): CategoryImportSummary['groupedByCategory'] {
    const catMap = new Map<string, {
      category: string;
      kind: 'income' | 'expense';
      subcategories: Map<string, boolean>; // name -> exists
      count: number;
      exists: boolean;
    }>();

    for (const row of rows) {
      const key = `${row.kind}:${row.category}`;

      if (catMap.has(key)) {
        const existing = catMap.get(key)!;
        if (row.subcategory) {
          existing.subcategories.set(row.subcategory, row.subcategoryExists ?? false);
        }
        existing.count += row.occurrences;
      } else {
        const subcategories = new Map<string, boolean>();
        if (row.subcategory) {
          subcategories.set(row.subcategory, row.subcategoryExists ?? false);
        }
        catMap.set(key, {
          category: row.category,
          kind: row.kind,
          subcategories,
          count: row.occurrences,
          exists: row.alreadyExists,
        });
      }
    }

    return Array.from(catMap.values()).map(c => ({
      category: c.category,
      kind: c.kind,
      subcategories: Array.from(c.subcategories.entries()).map(([name, exists]) => ({ name, exists })),
      count: c.count,
      exists: c.exists,
    })).sort((a, b) => {
      if (a.kind !== b.kind) {
        return a.kind === 'income' ? -1 : 1;
      }
      return a.category.localeCompare(b.category);
    });
  }

  /**
   * Validate edited rows before confirmation
   */
  validateRows(rows: ImportCategoryRow[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.selected) continue;

      // Validate category name
      if (!row.category || row.category.trim().length === 0) {
        errors.push(`Row ${row.rowNumber}: Category name is required`);
      }

      if (row.category && row.category.length > 100) {
        errors.push(`Row ${row.rowNumber}: Category name is too long (max 100 characters)`);
      }

      // Validate subcategory name if provided
      if (row.subcategory && row.subcategory.length > 100) {
        errors.push(`Row ${row.rowNumber}: Subcategory name is too long (max 100 characters)`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Confirm and save imported categories/subcategories
   */
  async confirmCategoryImport(
    userId: string,
    rows: ImportCategoryRow[],
  ): Promise<ConfirmCategoryImportResponse> {
    // Validate first
    const validation = this.validateRows(rows);
    if (!validation.valid) {
      return {
        categoriesCreated: 0,
        categoriesUpdated: 0,
        categoryIds: [],
        errors: validation.errors,
      };
    }

    // Get all existing categories for matching
    const existingCategories = await this.categoriesService.list(userId, false);
    const categoryMap = new Map(
      existingCategories.map(category => [
        this.buildCategoryKey(category.kind, category.name),
        category,
      ]),
    );

    const categoryIds: string[] = [];
    const errors: string[] = [];
    let categoriesCreated = 0;
    let categoriesUpdated = 0;

    // Process each selected row
    for (const row of rows) {
      if (!row.selected) continue;

      const categoryName = row.category.trim();
      const subcategoryName = row.subcategory?.trim();
      const categoryKey = this.buildCategoryKey(row.kind, categoryName);
      const existing = categoryMap.get(categoryKey);

      if (!categoryName) {
        errors.push(`Row ${row.rowNumber}: Category name is required`);
        continue;
      }

      if (existing) {
        // Update existing category with a new subcategory if needed
        try {
          const subcategories = [...existing.subcategories];

          if (
            subcategoryName &&
            !subcategories.some(sub => sub.toLowerCase() === subcategoryName.toLowerCase())
          ) {
            subcategories.push(subcategoryName);
          }

          // Only update if subcategories changed
          if (subcategories.length > existing.subcategories.length) {
            const updated = await this.categoriesService.update(userId, existing.id, {
              subcategories,
            });
            // Update the map with the new version so subsequent rows see the latest subcategories
            categoryMap.set(categoryKey, updated);
            categoriesUpdated++;
          }

          categoryIds.push(existing.id);
        } catch (err) {
          errors.push(`Row ${row.rowNumber}: Failed to update category \"${categoryName}\"`);
        }
      } else {
        // Create new category with optional subcategory
        try {
          const created = await this.categoriesService.create(userId, {
            name: categoryName,
            kind: row.kind,
            subcategories: subcategoryName ? [subcategoryName] : [],
          });
          categoryIds.push(created.id);
          categoryMap.set(categoryKey, created);
          categoriesCreated++;
        } catch (err) {
          errors.push(`Row ${row.rowNumber}: Failed to create category \"${categoryName}\"`);
        }
      }
    }

    return {
      categoriesCreated,
      categoriesUpdated,
      categoryIds,
      errors,
    };
  }

  private buildCategoryKey(kind: 'income' | 'expense', categoryName: string): string {
    return `${kind}:${categoryName.trim().toLowerCase()}`;
  }

  private resolveImportedCategoryName(
    category?: string,
    operationType?: string,
  ): string | undefined {
    const sanitizedCategory = this.sanitizeImportedLabel(category);
    if (sanitizedCategory) {
      return sanitizedCategory;
    }

    const sanitizedOperationType = this.sanitizeImportedLabel(operationType);
    if (sanitizedOperationType && this.isFallbackOperationType(sanitizedOperationType)) {
      return sanitizedOperationType;
    }

    return undefined;
  }

  private sanitizeImportedLabel(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim();
    if (!normalized || this.isToCategorizeLabel(normalized)) {
      return undefined;
    }

    return normalized;
  }

  private isToCategorizeLabel(value: string): boolean {
    return /cat[eé]goris/i.test(value);
  }

  private isFallbackOperationType(value: string): boolean {
    return /virement/i.test(value);
  }
}
