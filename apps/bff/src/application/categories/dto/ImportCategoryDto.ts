/**
 * DTOs for category import from CSV transactions
 * Extracts unique category/subcategory pairs for review and creation
 */

export interface ImportCategoryPair {
  /**
   * Category name from CSV
   */
  category: string;

  /**
   * Subcategory name from CSV (optional)
   */
  subcategory?: string;

  /**
   * Transaction type (income/expense)
   */
  kind: 'income' | 'expense';

  /**
   * Number of occurrences in the CSV
   */
  count: number;
}

export interface ImportCategoryRow {
  /**
   * Row number for UI display
   */
  rowNumber: number;

  /**
   * Category name (editable)
   */
  category: string;

  /**
   * Subcategory name (editable, optional)
   */
  subcategory?: string;

  /**
   * Kind (income/expense)
   */
  kind: 'income' | 'expense';

  /**
   * How many times this pair appears in CSV
   */
  occurrences: number;

  /**
   * Whether this category already exists
   */
  alreadyExists: boolean;

  /**
   * Whether this exact pair (category + subcategory) already exists
   */
  pairExists: boolean;

  /**
   * Whether the subcategory already exists in the category
   */
  subcategoryExists?: boolean;

  /**
   * Whether to include in final import
   */
  selected: boolean;

  /**
   * Warnings for this pair
   */
  warnings?: string[];
}

export interface CategoryImportSummary {
  /**
   * Total unique category/subcategory pairs found
   */
  totalPairs: number;

  /**
   * Number of new categories to create
   */
  newCategoriesCount: number;

  /**
   * Number of pairs (category+subcategory combos) that already exist
   */
  existingPairsCount: number;

  /**
   * Number of new subcategories to add
   */
  newSubcategoriesCount: number;

  /**
   * Detailed rows (editable)
   */
  rows: ImportCategoryRow[];

  /**
   * Grouped summary by category
   */
  groupedByCategory: Array<{
    category: string;
    kind: 'income' | 'expense';
    subcategories: Array<{ name: string; exists: boolean }>;
    count: number;
    exists: boolean;
  }>;
}

export interface ConfirmCategoryImportRequest {
  /**
   * Rows to import (after user edits)
   */
  rows: ImportCategoryRow[];
}

export interface ConfirmCategoryImportResponse {
  /**
   * Number of categories created
   */
  categoriesCreated: number;

  /**
   * Number of categories updated (subcategories added)
   */
  categoriesUpdated: number;

  /**
   * IDs of created/updated categories
   */
  categoryIds: string[];

  /**
   * Any errors
   */
  errors?: string[];
}
