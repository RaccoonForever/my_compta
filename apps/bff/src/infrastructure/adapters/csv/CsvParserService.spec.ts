import { describe, it, expect, beforeEach } from 'vitest';
import { CsvParserService } from './CsvParserService';

describe('CsvParserService', () => {
  let service: CsvParserService;

  beforeEach(() => {
    service = new CsvParserService();
  });

  describe('parse - basic functionality', () => {
    it('should parse simple CSV with header', () => {
      const csv = `name;age;city
John;30;NYC
Jane;25;LA`;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          age: parseInt(row[1], 10),
          city: row[2],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.successCount).toBe(2);
      expect(result.rows[0]).toEqual({
        name: 'John',
        age: 30,
        city: 'NYC',
      });
    });

    it('should parse CSV without header', () => {
      const csv = `John;30;NYC
Jane;25;LA`;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          age: parseInt(row[1], 10),
        }),
        { delimiter: ';', hasHeader: false },
      );

      expect(result.rows).toHaveLength(2);
      expect(result.summary.successCount).toBe(2);
    });

    it('should respect custom delimiter', () => {
      const csv = `name,age,city
John,30,NYC`;

      const result = service.parse(
        csv,
        (row) => ({ name: row[0], age: row[1] }),
        { delimiter: ',', hasHeader: true },
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].name).toBe('John');
      expect(result.rows[0].age).toBe('30');
    });
  });

  describe('parse - error handling', () => {
    it('should capture mapping errors and continue', () => {
      const csv = `name;age
John;thirty
Jane;25`;

      const result = service.parse(
        csv,
        (row) => {
          const age = parseInt(row[1], 10);
          if (isNaN(age)) {
            throw new Error('Invalid age');
          }
          return { name: row[0], age };
        },
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(1); // Only Jane parsed successfully
      expect(result.errors).toHaveLength(1); // John failed
      expect(result.summary.successCount).toBe(1);
      expect(result.summary.errorCount).toBe(1);
    });

    it('should capture row numbers for errors', () => {
      const csv = `name;age
John;thirty
Jane;25
Bob;invalid`;

      const result = service.parse(
        csv,
        (row) => {
          const age = parseInt(row[1], 10);
          if (isNaN(age)) {
            throw new Error('Invalid age');
          }
          return { name: row[0], age };
        },
        { delimiter: ';', hasHeader: true },
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].rowNumber).toBe(1); // John at data row 1
      expect(result.errors[1].rowNumber).toBe(3); // Bob at data row 3
    });
  });

  describe('parse - quoted fields', () => {
    it('should handle quoted fields with delimiters inside', () => {
      const csv = `name;description
John;"Lives in NYC, USA"
Jane;"Works at Company; Inc."`;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          description: row[1],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].description).toBe('Lives in NYC, USA');
      expect(result.rows[1].description).toContain('Company; Inc.');
    });

    it('should handle escaped quotes inside quoted fields', () => {
      const csv = `name;description
John;"Says ""hello"" to everyone"`;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          description: row[1],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].description).toContain('"hello"');
    });
  });

  describe('parse - whitespace handling', () => {
    it('should trim whitespace from fields', () => {
      const csv = `name;age;city
  John  ;  30  ;  NYC  `;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          age: row[1],
          city: row[2],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows[0].name).toBe('John');
      expect(result.rows[0].age).toBe('30');
      expect(result.rows[0].city).toBe('NYC');
    });

    it('should skip empty lines', () => {
      const csv = `name;age

John;30

Jane;25
`;

      const result = service.parse(
        csv,
        (row) => ({
          name: row[0],
          age: row[1],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(2);
      expect(result.summary.totalRows).toBe(2);
    });
  });

  describe('extractHeaders', () => {
    it('should extract header row', () => {
      const csv = `name;age;city
John;30;NYC
Jane;25;LA`;

      const headers = service.extractHeaders(csv, ';');

      expect(headers).toEqual(['name', 'age', 'city']);
    });

    it('should work with different delimiters', () => {
      const csv = `name,age,city
John,30,NYC`;

      const headers = service.extractHeaders(csv, ',');

      expect(headers).toEqual(['name', 'age', 'city']);
    });

    it('should handle empty CSV', () => {
      const csv = '';

      const headers = service.extractHeaders(csv, ';');

      expect(headers).toEqual([]);
    });
  });

  describe('parseCsvLine - private method via public API', () => {
    it('should parse line with quoted fields containing delimiters', () => {
      const csv = `normal;quoted;"field;with;delimiters";end`;

      const headers = service.extractHeaders(csv, ';');

      expect(headers).toEqual([
        'normal',
        'quoted',
        'field;with;delimiters',
        'end',
      ]);
    });

    it('should handle multiple consecutive delimiters as empty fields', () => {
      const csv = `a;;b`;

      const headers = service.extractHeaders(csv, ';');

      expect(headers.length).toBeGreaterThanOrEqual(3);
      expect(headers[0]).toBe('a');
      expect(headers[2]).toBe('b');
    });
  });

  describe('real-world French bank CSV', () => {
    it('should parse French bank format correctly', () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
27/02/2026;AESIO MUTUELLE;VIR SEPA AESIO;2605885K10732335;CONTRAT N 11003360;Virement recu;A categoriser;;0;+41,17;27/02/2026;27/02/2026;0
28/02/2026;EURESTG362;CB EURESTG362 FACT;REF123;;Carte bancaire;Alimentation;Restauration rapide;-13,11;;26/02/2026;02/03/2026;0`;

      const result = service.parse(
        csv,
        (row) => ({
          date: row[10],
          label: row[1],
          debit: row[8],
          credit: row[9],
        }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(2);
      expect(result.rows[0].label).toBe('AESIO MUTUELLE');
      expect(result.rows[0].credit).toBe('+41,17');
      expect(result.rows[1].label).toBe('EURESTG362');
      expect(result.rows[1].debit).toBe('-13,11');
    });
  });

  describe('edge cases', () => {
    it('should handle single field CSV', () => {
      const csv = `value
a
b
c`;

      const result = service.parse(
        csv,
        (row) => ({ value: row[0] }),
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].value).toBe('a');
    });

    it('should handle CSV with many columns', () => {
      const cols = Array(50)
        .fill(null)
        .map((_, i) => `col${i}`);
      const header = cols.join(';');
      const data = cols.map((_, i) => `val${i}`).join(';');
      const csv = `${header}\n${data}`;

      const result = service.parse(
        csv,
        (row) => row,
        { delimiter: ';', hasHeader: true },
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0]).toHaveLength(50);
    });
  });
});
