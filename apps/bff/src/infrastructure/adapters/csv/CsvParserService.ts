/**
 * CsvParserService - Independent CSV parsing service
 * Handles parsing CSV files with configurable delimiters and headers
 * Returns detailed parsing results with success/failure per row
 */

export interface CsvParseOptions {
  delimiter?: string;
  hasHeader?: boolean;
  encoding?: string;
}

export interface CsvParseResult<T> {
  rows: T[];
  errors: CsvParseError[];
  summary: {
    totalRows: number;
    successCount: number;
    errorCount: number;
  };
}

export interface CsvParseError {
  rowNumber: number;
  error: string;
  rawRow?: string[];
}

export class CsvParserService {
  /**
   * Parse CSV string content into structured data
   * @param content - Raw CSV file content
   * @param mapper - Function to transform CSV row (array of strings) into typed object
   * @param options - Parse options (delimiter, hasHeader, etc)
   */
  parse<T>(
    content: string,
    mapper: (row: string[], rowNumber: number) => T,
    options: CsvParseOptions = {},
  ): CsvParseResult<T> {
    const {
      delimiter = ';',
      hasHeader = true,
    } = options;

    const rows: T[] = [];
    const errors: CsvParseError[] = [];

    try {
      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const startIndex = hasHeader ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        // Row number for user display: first data row is 1 (excluding header)
        const rowNumber = hasHeader ? i : i + 1;
        const line = lines[i];

        try {
          const csvRow = this.parseCsvLine(line, delimiter);
          
          if (csvRow.length === 0) {
            continue; // Skip empty rows
          }

          const mappedRow = mapper(csvRow, rowNumber);
          rows.push(mappedRow);
        } catch (error) {
          errors.push({
            rowNumber,
            error: error instanceof Error ? error.message : String(error),
            rawRow: this.parseCsvLine(line, delimiter),
          });
        }
      }
    } catch (error) {
      throw new Error(
        `CSV parsing failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      rows,
      errors,
      summary: {
        totalRows: rows.length + errors.length,
        successCount: rows.length,
        errorCount: errors.length,
      },
    };
  }

  /**
   * Parse a single CSV line respecting quoted fields
   * Handles semicolon-delimited CSV with quoted values containing delimiters
   */
  private parseCsvLine(line: string, delimiter: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++;
        } else {
          // Toggle quote state
          insideQuotes = !insideQuotes;
        }
      } else if (char === delimiter && !insideQuotes) {
        // Field delimiter
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Add last field
    result.push(current.trim());

    return result;
  }

  /**
   * Extract headers from CSV content
   */
  extractHeaders(content: string, delimiter: string = ';'): string[] {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      return [];
    }

    return this.parseCsvLine(lines[0], delimiter);
  }
}
