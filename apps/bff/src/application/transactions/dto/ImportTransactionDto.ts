/**
 * DTOs for CSV transaction import
 * Defines the shape of imported data and import results
 */

export interface ImportTransactionDto {
  /**
   * Transaction date (operation date from bank)
   * Expected format: DD/MM/YYYY
   */
  date: string;

  /**
   * Transaction amount (positive for income, negative for expense)
   */
  amount: number;

  /**
   * Transaction description/label
   */
  label: string;

  /**
   * Transaction type: 'income' | 'expense' | 'transfer'
   */
  type: 'income' | 'expense' | 'transfer';

  /**
   * Category name from bank export
   * Will be mapped or created if needed
   */
  category?: string;

  /**
   * Sub-category from bank export
   */
  subcategory?: string;

  /**
   * Bank-provided reference
   */
  reference?: string;

  /**
   * Additional notes/details
   */
  notes?: string;

  /**
   * Operation type from bank (e.g., "Carte bancaire", "Virement")
   */
  operationType?: string;
}

export interface ImportRowResult {
  /**
   * CSV row number (1-indexed)
   */
  rowNumber: number;

  /**
   * Whether this row was successfully parsed
   */
  success: boolean;

  /**
   * Parsed transaction data if successful
   */
  transaction?: ImportTransactionDto;

  /**
   * Error message if failed
   */
  error?: string;

  /**
   * Warnings (e.g., "category not found, will create new")
   */
  warnings?: string[];

  /**
   * Raw CSV values for debugging
   */
  rawRow?: string[];
}

export interface ImportSummary {
  /**
   * Total rows processed
   */
  totalRows: number;

  /**
   * Successfully parsed transactions
   */
  successCount: number;

  /**
   * Failed transactions
   */
  errorCount: number;

  /**
   * Rows with warnings (parsed but needs attention)
   */
  warningCount: number;

  /**
   * Detailed results per row
   */
  results: ImportRowResult[];

  /**
   * Summary of issues grouped by type
   */
  issueSummary?: {
    invalidAmounts: number;
    invalidDates: number;
    missingCategories: number;
    otherErrors: number;
  };
}

export interface ConfirmImportRequest {
  /**
   * Summary from initial import
   */
  summary: ImportSummary;

  /**
   * Selected account ID to import transactions into
   */
  accountId: string;

  /**
   * Whether to auto-categorize transactions based on bank categories
   */
  autoMapCategories?: boolean;

  /**
   * Whether to skip duplicate detection (default: false)
   */
  skipDuplicateCheck?: boolean;
}

export interface ConfirmImportResponse {
  /**
   * Number of transactions actually created
   */
  createdCount: number;

  /**
   * Number of transactions skipped (duplicates)
   */
  skippedCount: number;

  /**
   * Number of transactions failed
   */
  failedCount: number;

  /**
   * IDs of created transactions
   */
  transactionIds: string[];

  /**
   * Any final errors
   */
  errors?: string[];
}
