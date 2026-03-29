import { Injectable, Inject } from '@nestjs/common';
import { CsvParserService } from '../../infrastructure/adapters/csv/CsvParserService';
import {
  ImportTransactionDto,
  ImportRowResult,
  ImportSummary,
  ConfirmImportRequest,
  ConfirmImportResponse,
} from './dto/ImportTransactionDto';
import { TransactionsService } from './transactions.service';
import { TransactionRepository, TRANSACTION_REPOSITORY } from '../ports/TransactionRepository';
import { CategoryRepository, CATEGORY_REPOSITORY } from '../ports/CategoryRepository';
import { AccountRepository, ACCOUNT_REPOSITORY } from '../ports/AccountRepository';
import { NotFoundError } from '@my-compta/domain';

/**
 * BankCsvFormat - Configuration for different bank CSV formats
 */
export interface BankCsvFormat {
  delimiter: string;
  dateFormat: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  hasHeader: boolean;
  headerMapping: {
    date: number; // Column index
    label: number;
    debit?: number;
    credit?: number;
    amount?: number; // If single column
    type?: number;
    category?: number;
    subcategory?: number;
    reference?: number;
    notes?: number;
    operationType?: number;
  };
}

/**
 * French bank CSV format (from your example)
 */
const FRENCH_BANK_FORMAT: BankCsvFormat = {
  delimiter: ';',
  dateFormat: 'DD/MM/YYYY',
  hasHeader: true,
  headerMapping: {
    date: 10, // Date operation
    label: 1, // Libelle simplifie
    debit: 8, // Debit
    credit: 9, // Credit
    type: 5, // Type operation
    category: 6, // Categorie
    subcategory: 7, // Sous categorie
    reference: 3, // Reference
    notes: 4, // Informations complementaires
    operationType: 5, // Type operation
  },
};

@Injectable()
export class TransactionImportService {
  constructor(
    private csvParser: CsvParserService,
    private transactionsService: TransactionsService,
    @Inject(TRANSACTION_REPOSITORY)
    private transactionRepo: TransactionRepository,
    @Inject(CATEGORY_REPOSITORY)
    private categoryRepo: CategoryRepository,
    @Inject(ACCOUNT_REPOSITORY)
    private accountRepo: AccountRepository,
  ) {}

  /**
   * Parse and validate a CSV file
   * Returns detailed summary of which rows succeeded/failed without modifying database
   */
  async parseAndValidateCsv(
    csvContent: string,
    format: BankCsvFormat = FRENCH_BANK_FORMAT,
  ): Promise<ImportSummary> {
    // Track row numbers alongside parsed transactions
    interface ParsedWithRowNumber {
      transaction: ImportTransactionDto;
      rowNumber: number;
    }

    const mapper = (row: string[], rowNumber: number): ParsedWithRowNumber => {
      return {
        transaction: this.mapCsvRowToTransaction(row, rowNumber, format),
        rowNumber,
      };
    };

    const parseResult = this.csvParser.parse<ParsedWithRowNumber>(
      csvContent,
      mapper,
      {
        delimiter: format.delimiter,
        hasHeader: format.hasHeader,
      },
    );

    // Validate each parsed transaction and collect detailed results
    const results: ImportRowResult[] = [];
    const warnings: Map<string, number> = new Map();

    // Process successful parses
    for (const parsed of parseResult.rows) {
      const validation = this.validateTransaction(parsed.transaction);
      results.push({
        rowNumber: parsed.rowNumber,
        success: true,
        transaction: parsed.transaction,
        warnings: validation.warnings,
      });

      if (validation.warnings.length > 0) {
        validation.warnings.forEach((w) => {
          warnings.set(w, (warnings.get(w) || 0) + 1);
        });
      }
    }

    // Process parsing errors
    for (const parseError of parseResult.errors) {
      results.push({
        rowNumber: parseError.rowNumber,
        success: false,
        error: parseError.error,
        rawRow: parseError.rawRow,
      });
    }

    // Sort by row number
    results.sort((a, b) => a.rowNumber - b.rowNumber);

    // Calculate issue summary
    const issueSummary = this.calculateIssueSummary(results);

    return {
      totalRows: parseResult.summary.totalRows,
      successCount: parseResult.summary.successCount,
      errorCount: parseResult.summary.errorCount,
      warningCount: Array.from(warnings.values()).reduce((a, b) => a + b, 0),
      results,
      issueSummary,
    };
  }

  /**
   * Map a CSV row to ImportTransactionDto based on format configuration
   */
  private mapCsvRowToTransaction(
    row: string[],
    _rowNumber: number,
    format: BankCsvFormat,
  ): ImportTransactionDto {
    const { headerMapping } = format;

    // Extract fields by column index
    const dateStr = row[headerMapping.date]?.trim() || '';
    const label = row[headerMapping.label]?.trim() || '';
    const debitStr = row[headerMapping.debit!]?.trim() || '';
    const creditStr = row[headerMapping.credit!]?.trim() || '';
    const category = row[headerMapping.category!]?.trim();
    const subcategory = row[headerMapping.subcategory!]?.trim();
    const reference = row[headerMapping.reference!]?.trim();
    const notes = row[headerMapping.notes!]?.trim();
    const operationType = row[headerMapping.operationType!]?.trim();

    // Parse amount (debit and credit columns from bank export)
    // In this format: debit = negative outflow, credit = positive inflow
    // Only one of them will have a value
    const debit = debitStr ? this.parseAmount(debitStr) : 0;
    const credit = creditStr ? this.parseAmount(creditStr) : 0;
    
    // Use whichever has a value (one should be 0, the other should have the amount)
    const amount = debit !== 0 ? debit : credit;

    // Determine transaction type based on amount and operation type
    const type = this.determineTransactionType(amount);

    // Parse and validate date
    const date = this.parseDate(dateStr, format.dateFormat);

    return {
      date,
      amount,
      label,
      type,
      category,
      subcategory,
      reference,
      notes,
      operationType,
    };
  }

  /**
   * Parse amount string, handling French format (comma as decimal)
   */
  private parseAmount(amountStr: string): number {
    if (!amountStr) return 0;

    // Remove whitespace and convert French format (comma) to English (dot)
    const normalized = amountStr.trim().replace(',', '.');

    // Remove + sign if present
    const cleaned = normalized.replace('+', '');

    const amount = parseFloat(cleaned);

    if (isNaN(amount)) {
      throw new Error(`Invalid amount format: "${amountStr}"`);
    }

    return amount;
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string, format: string): string {
    if (!dateStr) {
      throw new Error('Date is required');
    }

    try {
      if (format === 'DD/MM/YYYY') {
        const [day, month, year] = dateStr.split('/');
        const date = new Date(
          parseInt(year, 10),
          parseInt(month, 10) - 1,
          parseInt(day, 10),
        );

        if (isNaN(date.getTime())) {
          throw new Error('Invalid date');
        }

        // Return as ISO string
        return date.toISOString().split('T')[0];
      }
      throw new Error(`Unsupported date format: ${format}`);
    } catch (error) {
      throw new Error(
        `Cannot parse date "${dateStr}": ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Determine transaction type based on amount and operation type
   * Logic:
   * - Positive amount = income, negative = expense
   */
  private determineTransactionType(
    amount: number,
  ): 'income' | 'expense' {
    return amount > 0 ? 'income' : 'expense';
  }

  /**
   * Validate a transaction and return warnings if any
   */
  private validateTransaction(
    transaction: ImportTransactionDto,
  ): { warnings: string[] } {
    const warnings: string[] = [];

    // Validate amount
    if (Math.abs(transaction.amount) < 0.01) {
      warnings.push('Amount is very small (< €0.01)');
    }

    // Check for missing category
    if (!transaction.category || transaction.category === 'A categoriser') {
      warnings.push(
        'Category is missing or marked as "to categorize" - will need manual assignment',
      );
    }

    // Check for missing label
    if (!transaction.label || transaction.label.length < 2) {
      warnings.push('Label is very short - may be unclear');
    }

    return { warnings };
  }

  /**
   * Calculate summary of issues by category
   */
  private calculateIssueSummary(
    results: ImportRowResult[],
  ): ImportSummary['issueSummary'] {
    let invalidAmounts = 0;
    let invalidDates = 0;
    let missingCategories = 0;
    let otherErrors = 0;

    for (const result of results) {
      if (!result.success) {
        const error = result.error || '';
        if (error.includes('amount') || error.includes('Amount')) {
          invalidAmounts++;
        } else if (error.includes('date') || error.includes('Date')) {
          invalidDates++;
        } else {
          otherErrors++;
        }
      }

      if (result.warnings) {
        for (const warning of result.warnings) {
          if (warning.includes('Category') || warning.includes('category')) {
            missingCategories++;
          }
        }
      }
    }

    return {
      invalidAmounts,
      invalidDates,
      missingCategories,
      otherErrors,
    };
  }

  /**
   * Check if a transaction already exists (duplicate detection)
   * Useful for preventing duplicate imports
   */
  isDuplicate(
    transaction: ImportTransactionDto,
    existing: ImportTransactionDto[],
  ): boolean {
    return existing.some((t) => this.areDuplicateTransactions(transaction, t));
  }

  private areDuplicateTransactions(
    first: ImportTransactionDto,
    second: ImportTransactionDto,
  ): boolean {
    const firstAmountInCents = Math.round(first.amount * 100);
    const secondAmountInCents = Math.round(second.amount * 100);

    const sameCoreIdentity =
      first.date === second.date &&
      firstAmountInCents === secondAmountInCents &&
      first.label === second.label;

    if (!sameCoreIdentity) {
      return false;
    }

    const firstReference = this.normalizeReference(first.reference);
    const secondReference = this.normalizeReference(second.reference);

    // If both sides have a reference, it must match to be considered a duplicate.
    // If one side has no reference, keep legacy behavior and match on core identity.
    if (firstReference && secondReference) {
      return firstReference === secondReference;
    }

    return true;
  }

  private normalizeReference(reference?: string): string | undefined {
    if (!reference) {
      return undefined;
    }

    const normalized = reference.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  /**
   * Confirm and save validated import
   * Takes the validated summary and creates transactions in the database
   */
  async confirmImport(
    userId: string,
    request: ConfirmImportRequest,
  ): Promise<ConfirmImportResponse> {
    const { summary, accountId } = request;

    // Get account to determine currency
    const account = await this.accountRepo.findById(userId, accountId);
    if (!account) {
      throw new NotFoundError('Account', accountId);
    }

    // Extract successfully validated transactions
    const successfulTransactions = summary.results
      .filter((r) => r.success && r.transaction)
      .map((r) => r.transaction!);

    // Optionally check for duplicates if requested
    let transactionsToImport = successfulTransactions;
    let skippedCount = 0;

    if (!request.skipDuplicateCheck) {
      // Fetch existing transactions for the same account
      const existingTxs = await this.transactionRepo.findByUser(userId, {
        accountId,
      });

      const existingImportFormat: ImportTransactionDto[] = existingTxs.map(
        (tx) => ({
          date: tx.date.toISOString().split('T')[0],
          amount: tx.type === 'expense' ? -tx.amount.value : tx.amount.value, // Apply sign based on type
          label: tx.label,
          type: tx.type as 'income' | 'expense',
        }),
      );

      // Filter out duplicates against existing transactions and within the same import batch.
      const seenTransactions = [...existingImportFormat];
      transactionsToImport = successfulTransactions.filter((tx) => {
        if (this.isDuplicate(tx, seenTransactions)) {
          return false;
        }

        seenTransactions.push(tx);
        return true;
      });

      skippedCount = successfulTransactions.length - transactionsToImport.length;
    }

    // Load categories for optional auto-mapping
    const categories = await this.categoryRepo.findAllByUser(userId);
    const categoryMap = new Map<string, string>(
      categories.map((cat) => [cat.name.toLowerCase(), cat.id]),
    );

    // Create transactions
    const transactionIds: string[] = [];
    const errors: string[] = [];
    let createdCount = 0;
    let failedCount = 0;

    for (const importedTx of transactionsToImport) {
      try {
        // Try to map category if auto-mapping is enabled
        let categoryId: string | undefined;
        let validSubcategory: string | undefined;
        
        if (request.autoMapCategories && importedTx.category) {
          categoryId = categoryMap.get(importedTx.category.toLowerCase()) ?? undefined;
        }

        // Validate subcategory belongs to the category
        if (categoryId && importedTx.subcategory) {
          const category = categories.find(cat => cat.id === categoryId);
          if (category && category.subcategories.includes(importedTx.subcategory)) {
            validSubcategory = importedTx.subcategory;
          }
          // If subcategory doesn't match, validSubcategory remains undefined
        }

        // Format for saving
        const txDto = this.formatForSaving(importedTx, accountId, account.currency, categoryId, validSubcategory);

        // Create using the transactions service
        const created = await this.transactionsService.create(userId, txDto);
        transactionIds.push(created.id);
        createdCount++;
      } catch (error) {
        failedCount++;
        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        errors.push(
          `Failed to import "${importedTx.label}" (${importedTx.date}): ${errorMsg}`,
        );
      }
    }

    return {
      createdCount,
      skippedCount,
      failedCount,
      transactionIds,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Format imported transaction for saving
   * Maps ImportTransactionDto to CreateTransactionDto
   */
  /**
   * Format imported transaction for saving
   * Maps ImportTransactionDto to CreateTransactionDto
   */
  formatForSaving(
    imported: ImportTransactionDto,
    accountId: string,
    currency: string,
    categoryId?: string,
    validSubcategory?: string,
  ): {
    accountId: string;
    amount: number;
    currency: 'CHF' | 'EUR' | 'USD' | 'GBP';
    type: 'income' | 'expense';
    date: string;
    label: string;
    categoryId?: string;
    subcategory?: string;
    note?: string;
  } {
    return {
      accountId,
      amount: Math.abs(imported.amount),
      currency: currency as 'CHF' | 'EUR' | 'USD' | 'GBP',
      type: imported.type,
      date: imported.date,
      label: imported.label,
      categoryId,
      subcategory: validSubcategory,
      note: [imported.notes, imported.reference, imported.operationType]
        .filter(Boolean)
        .join(' | ') || undefined,
    };
  }
}
