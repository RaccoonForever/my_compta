import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionImportService } from './transaction-import.service';
import { CsvParserService } from '../../infrastructure/adapters/csv/CsvParserService';
import { ImportTransactionDto, ConfirmImportRequest } from './dto/ImportTransactionDto';
import { TransactionsService } from './transactions.service';
import { Account, Category, Transaction } from '@my-compta/domain';

// Mock implementations
class MockTransactionsService {
  constructor(private readonly transactionRepo: MockTransactionRepository) {}

  async create(userId: string, dto: any): Promise<any> {
    // Simulate validation that would happen in the real service
    if (dto.date && new Date(dto.date) > new Date()) {
      throw new Error('Transaction date cannot be in the future');
    }

    const id = 'tx-' + Math.random().toString(36).slice(2, 11);
    const persisted = Transaction.fromPrimitives({
      id,
      userId,
      accountId: dto.accountId,
      categoryId: dto.categoryId,
      subcategory: dto.subcategory,
      type: dto.type,
      isForecasted: false,
      amount: { value: dto.amount, currency: dto.currency },
      date: new Date(dto.date),
      label: dto.label,
      note: dto.note,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    this.transactionRepo.addTransaction(persisted);
    
    return {
      id,
      ...dto,
    };
  }
}

class MockTransactionRepository {
  private transactions: Transaction[] = [];
  
  async findByUser(userId: string, filters?: any): Promise<Transaction[]> {
    return this.transactions.filter((tx) => {
      if (tx.userId !== userId) {
        return false;
      }
      if (filters?.accountId && tx.accountId !== filters.accountId) {
        return false;
      }
      return true;
    });
  }

  addTransaction(tx: Transaction) {
    this.transactions.push(tx);
  }
  
  setExistingTransactions(txs: Transaction[]) {
    this.transactions = txs;
  }
}

class MockCategoryRepository {
  private categories: Category[] = [];
  
  async findAllByUser(userId: string): Promise<Category[]> {
    return this.categories;
  }
  
  setCategories(cats: Category[]) {
    this.categories = cats;
  }
}

class MockAccountRepository {
  private accounts: Map<string, Account> = new Map();
  
  async findById(userId: string, accountId: string): Promise<Account | null> {
    return this.accounts.get(accountId) || null;
  }
  
  setAccount(accountId: string, account: Account) {
    this.accounts.set(accountId, account);
  }
}

describe('TransactionImportService', () => {
  let service: TransactionImportService;
  let csvParser: CsvParserService;

  beforeEach(() => {
    csvParser = new CsvParserService();
    // For parsing tests, we only need csvParser (other params are undefined for these tests)
    service = new TransactionImportService(
      csvParser,
      undefined as any,
      undefined as any,
      undefined as any,
      undefined as any,
    );
  });

  describe('parseAndValidateCsv - French bank format', () => {
    it('should parse valid French bank CSV with income and expense transactions', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
27/02/2026;AESIO MUTUELLE;VIR SEPA AESIO;2605885K10732335;CONTRAT N 11003360;Virement recu;A categoriser;;0;+41,17;27/02/2026;27/02/2026;0
28/02/2026;EURESTG362;CB EURESTG362 FACT;REF123;;Carte bancaire;Alimentation;Restauration rapide;-13,11;;26/02/2026;02/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(2);
      expect(summary.errorCount).toBe(0);
      expect(summary.totalRows).toBe(2);
      expect(summary.results).toHaveLength(2);
    });

    it('should correctly parse income transaction (credit)', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
27/02/2026;SALARY;VIR SEPA SALARY;REF123;;Virement recu;Revenus;;0;+2500,50;27/02/2026;27/02/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      const transaction = summary.results[0].transaction!;
      expect(transaction.amount).toBe(2500.5);
      expect(transaction.type).toBe('income');
    });

    it('should correctly parse expense transaction (debit)', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
28/02/2026;GROCERY;CB RETAIL;REF456;;Carte bancaire;Alimentation;Supermarche;-89,99;;28/02/2026;28/02/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      const transaction = summary.results[0].transaction!;
      expect(transaction.amount).toBe(-89.99);
      expect(transaction.type).toBe('expense');
    });

    it('should parse date correctly from DD/MM/YYYY format', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
15/01/2026;TEST;CB TEST;REF;NOTE;Carte bancaire;Test;;-50;;15/01/2026;15/01/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      const transaction = summary.results[0].transaction!;
      expect(transaction.date).toBe('2026-01-15');
    });

    it('should handle floating point amounts with comma separator', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;PRECISE;CB PRECISE;REF;NOTE;Carte bancaire;Test;;-123,45;;01/03/2026;01/03/2026;0
01/03/2026;PRECISE2;CB PRECISE2;REF;NOTE;Carte bancaire;Test;;-0,01;;01/03/2026;01/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(2);
      expect(summary.results[0].transaction!.amount).toBe(-123.45);
      expect(summary.results[1].transaction!.amount).toBe(-0.01);
    });

    it('should report warnings for missing categories', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;UNKNOWN;CB UNKNOWN;REF;NOTE;Carte bancaire;A categoriser;;-50;;01/03/2026;01/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      expect(summary.results[0].warnings).toBeDefined();
      expect(summary.results[0].warnings!.length).toBeGreaterThan(0);
      expect(
        summary.results[0].warnings!.some((w) =>
          w.includes('Category'),
        ),
      ).toBe(true);
    });

    it('should report warnings for small amounts', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TINY;CB TINY;REF;NOTE;Carte bancaire;Test;;-0,001;;01/03/2026;01/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      expect(summary.results[0].warnings).toBeDefined();
      expect(
        summary.results[0].warnings!.some((w) => w.includes('very small')),
      ).toBe(true);
    });

    it('should handle invalid amounts with error', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;INVALID;CB INVALID;REF;NOTE;Carte bancaire;Test;;invalid;;01/03/2026;01/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.errorCount).toBeGreaterThan(0);
      expect(
        summary.results.some((r) => r.error && r.error.includes('Invalid amount')),
      ).toBe(true);
    });

    it('should handle invalid dates with error', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;INVALID;CB INVALID;REF;NOTE;Carte bancaire;Test;;-50;;invalid-date;01/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.errorCount).toBeGreaterThan(0);
      expect(
        summary.results.some((r) => r.error && r.error.includes('Cannot parse date')),
      ).toBe(true);
    });

    it('should preserve all transaction details', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
15/02/2026;FULL;VIR SEPA FULL;REF2605885K10732335;DETAILED NOTE;Virement recu;Revenus et rentrees d'argent;Remboursements de soins;;+456,78;15/02/2026;15/02/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(1);
      const tx = summary.results[0].transaction!;
      expect(tx.label).toBe('FULL');
      expect(tx.category).toBe('Revenus et rentrees d\'argent');
      expect(tx.subcategory).toBe('Remboursements de soins');
      expect(tx.reference).toBe('REF2605885K10732335');
      expect(tx.notes).toBe('DETAILED NOTE');
      expect(tx.operationType).toBe('Virement recu');
    });

    it('should calculate correct issue summary', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;GOOD;CB GOOD;REF;NOTE;Carte bancaire;Test;;-50;;01/03/2026;01/03/2026;0
02/03/2026;BAD;CB BAD;REF;NOTE;Carte bancaire;Test;;invalid;;02/03/2026;02/03/2026;0
03/03/2026;UNCATEGORIZED;CB UNCATEGORIZED;REF;NOTE;Carte bancaire;A categoriser;;-50;;03/03/2026;03/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(2);
      expect(summary.errorCount).toBe(1);
      expect(summary.issueSummary).toBeDefined();
      expect(summary.issueSummary!.invalidAmounts).toBeGreaterThan(0);
    });

    it('should handle empty rows gracefully', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;GOOD;CB GOOD;REF;NOTE;Carte bancaire;Test;;-50;;01/03/2026;01/03/2026;0

02/03/2026;GOOD2;CB GOOD2;REF;NOTE;Carte bancaire;Test;;-30;;02/03/2026;02/03/2026;0`;

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(2);
      expect(summary.errorCount).toBe(0);
    });

    it('should handle large CSV files', async () => {
      let csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation\n`;

      // Generate 100 transactions
      for (let i = 0; i < 100; i++) {
        const day = String((i % 28) + 1).padStart(2, '0');
        csv += `${day}/03/2026;TX${i};CB TX${i};REF${i};;Carte bancaire;Test;;-${i + 1},50;;${day}/03/2026;${day}/03/2026;0\n`;
      }

      const summary = await service.parseAndValidateCsv(csv);

      expect(summary.successCount).toBe(100);
      expect(summary.errorCount).toBe(0);
      expect(summary.totalRows).toBe(100);
    });
  });

  describe('isDuplicate detection', () => {
    it('should detect exact duplicate transactions', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: -50.0,
        label: 'GROCERY',
        type: 'expense',
      };

      const existing: ImportTransactionDto[] = [
        { ...tx },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(true);
    });

    it('should detect duplicates with signed amounts (expense)', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: -50.0, // Negative for expense
        label: 'GROCERY',
        type: 'expense',
      };

      const existing: ImportTransactionDto[] = [
        {
          date: '2026-03-01',
          amount: -50.0, // Also negative
          label: 'GROCERY',
          type: 'expense',
        },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(true);
    });

    it('should detect duplicates with signed amounts (income)', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: 2500.0, // Positive for income
        label: 'SALARY',
        type: 'income',
      };

      const existing: ImportTransactionDto[] = [
        {
          date: '2026-03-01',
          amount: 2500.0, // Also positive
          label: 'SALARY',
          type: 'income',
        },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(true);
    });

    it('should not flag similar but different transactions as duplicates', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: -50.0,
        label: 'GROCERY',
        type: 'expense',
      };

      const existing: ImportTransactionDto[] = [
        {
          date: '2026-03-01',
          amount: -50.5, // Different amount
          label: 'GROCERY',
          type: 'expense',
        },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(false);
    });

    it('should handle floating point comparison tolerance', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: -50.001,
        label: 'GROCERY',
        type: 'expense',
      };

      const existing: ImportTransactionDto[] = [
        {
          date: '2026-03-01',
          amount: -50.002, // Tiny difference, should be treated as duplicate
          label: 'GROCERY',
          type: 'expense',
        },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(true);
    });

    it('should not treat transactions with different references as duplicates', () => {
      const tx: ImportTransactionDto = {
        date: '2026-03-01',
        amount: -50.0,
        label: 'GROCERY',
        type: 'expense',
        reference: 'REF-001',
      };

      const existing: ImportTransactionDto[] = [
        {
          date: '2026-03-01',
          amount: -50.0,
          label: 'GROCERY',
          type: 'expense',
          reference: 'REF-002',
        },
      ];

      expect(service.isDuplicate(tx, existing)).toBe(false);
    });
  });

  describe('confirmImport integration', () => {
    let serviceWithMocks: TransactionImportService;
    let mockTransactionsService: MockTransactionsService;
    let mockTransactionRepo: MockTransactionRepository;
    let mockCategoryRepo: MockCategoryRepository;
    let mockAccountRepo: MockAccountRepository;

    beforeEach(() => {
      mockTransactionRepo = new MockTransactionRepository();
      mockTransactionsService = new MockTransactionsService(mockTransactionRepo);
      mockCategoryRepo = new MockCategoryRepository();
      mockAccountRepo = new MockAccountRepository();

      serviceWithMocks = new TransactionImportService(
        csvParser,
        mockTransactionsService as any,
        mockTransactionRepo as any,
        mockCategoryRepo as any,
        mockAccountRepo as any,
      );

      // Setup a default account
      const mockAccount = Account.create({
        id: 'acc-1',
        userId: 'user-1',
        name: 'Main Account',
        type: 'bank',
        currency: 'EUR',
        balance: 1000,
        createdAt: new Date('2024-01-01'),
      });
      mockAccountRepo.setAccount('acc-1', mockAccount);
    });

    it('should successfully import all valid transactions', async () => {
      const summary = {
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0,
              label: 'GROCERY',
              type: 'expense' as const,
            },
          },
          {
            rowNumber: 2,
            success: true,
            transaction: {
              date: '2026-03-02',
              amount: 100.0,
              label: 'SALARY',
              type: 'income' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: false,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(2);
      expect(result.failedCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.transactionIds).toHaveLength(2);
    });

    it('should skip duplicate transactions', async () => {
      // Setup existing transaction
      // Note: Transaction entity stores absolute amount
      const existingTx = Transaction.fromPrimitives({
        id: 'tx-existing',
        userId: 'user-1',
        accountId: 'acc-1',
        categoryId: undefined,
        subcategory: undefined,
        type: 'expense',
        isForecasted: false,
        amount: { value: 50.0, currency: 'EUR' },
        date: new Date('2026-03-01'),
        label: 'GROCERY',
        note: undefined,
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-01T00:00:00.000Z'),
      });
      mockTransactionRepo.setExistingTransactions([existingTx]);

      const summary = {
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0, // Import format has signed amount (negative for expense)
              label: 'GROCERY',
              type: 'expense' as const,
            },
          },
          {
            rowNumber: 2,
            success: true,
            transaction: {
              date: '2026-03-02',
              amount: -30.0,
              label: 'CAFE',
              type: 'expense' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: false,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should skip duplicates inside the same import batch', async () => {
      const summary = {
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-03',
              amount: -42.5,
              label: 'RESTAURANT',
              type: 'expense' as const,
            },
          },
          {
            rowNumber: 2,
            success: true,
            transaction: {
              date: '2026-03-03',
              amount: -42.5,
              label: 'RESTAURANT',
              type: 'expense' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: false,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(1);
      expect(result.skippedCount).toBe(1);
      expect(result.failedCount).toBe(0);
    });

    it('should import transactions with same date amount and label when reference differs', async () => {
      const summary = {
        totalRows: 2,
        successCount: 2,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-03',
              amount: -42.5,
              label: 'RESTAURANT',
              type: 'expense' as const,
              reference: 'REF-AAA',
            },
          },
          {
            rowNumber: 2,
            success: true,
            transaction: {
              date: '2026-03-03',
              amount: -42.5,
              label: 'RESTAURANT',
              type: 'expense' as const,
              reference: 'REF-BBB',
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: false,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(2);
      expect(result.skippedCount).toBe(0);
      expect(result.failedCount).toBe(0);
    });

    it('should not reimport the same transactions when confirming twice', async () => {
      const summary = {
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-04',
              amount: -18.9,
              label: 'COFFEE SHOP',
              type: 'expense' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: false,
      };

      const firstImport = await serviceWithMocks.confirmImport('user-1', request);
      const secondImport = await serviceWithMocks.confirmImport('user-1', request);

      expect(firstImport.createdCount).toBe(1);
      expect(firstImport.skippedCount).toBe(0);
      expect(secondImport.createdCount).toBe(0);
      expect(secondImport.skippedCount).toBe(1);
      expect(secondImport.failedCount).toBe(0);
    });

    it('should auto-map categories when enabled', async () => {
      // Setup categories
      const foodCategory = Category.create({
        id: 'cat-food',
        userId: 'user-1',
        name: 'Alimentation',
        kind: 'expense',
        subcategories: ['Restauration rapide', 'Supermarche'],
      });
      mockCategoryRepo.setCategories([foodCategory]);

      const summary = {
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0,
              label: 'GROCERY',
              type: 'expense' as const,
              category: 'Alimentation',
              subcategory: 'Supermarche',
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: true,
        skipDuplicateCheck: true,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(1);
      expect(result.failedCount).toBe(0);
      // The transaction should have been created with categoryId 'cat-food'
    });

    it('should ignore invalid subcategories that do not belong to category', async () => {
      // Setup categories
      const foodCategory = Category.create({
        id: 'cat-food',
        userId: 'user-1',
        name: 'Alimentation',
        kind: 'expense',
        subcategories: ['Restauration rapide', 'Supermarche'],
      });
      mockCategoryRepo.setCategories([foodCategory]);

      const summary = {
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0,
              label: 'GROCERY',
              type: 'expense' as const,
              category: 'Alimentation',
              subcategory: 'InvalidSubcategory', // This doesn't exist in foodCategory
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: true,
        skipDuplicateCheck: true,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(1);
      expect(result.failedCount).toBe(0);
      // Transaction should be created but without subcategory
    });

    it('should handle partial failures and continue importing', async () => {
      // Override create to fail for specific transactions
      const originalCreate = mockTransactionsService.create.bind(mockTransactionsService);
      mockTransactionsService.create = async (userId: string, dto: any) => {
        if (dto.label === 'FAIL') {
          throw new Error('Account creation date is too recent');
        }
        return originalCreate(userId, dto);
      };

      const summary = {
        totalRows: 3,
        successCount: 3,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0,
              label: 'SUCCESS1',
              type: 'expense' as const,
            },
          },
          {
            rowNumber: 2,
            success: true,
            transaction: {
              date: '2026-03-02',
              amount: -30.0,
              label: 'FAIL',
              type: 'expense' as const,
            },
          },
          {
            rowNumber: 3,
            success: true,
            transaction: {
              date: '2026-03-03',
              amount: -20.0,
              label: 'SUCCESS2',
              type: 'expense' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'acc-1',
        autoMapCategories: false,
        skipDuplicateCheck: true,
      };

      const result = await serviceWithMocks.confirmImport('user-1', request);

      expect(result.createdCount).toBe(2); // SUCCESS1 and SUCCESS2
      expect(result.failedCount).toBe(1); // FAIL
      expect(result.errors).toBeDefined();
      expect(result.errors![0]).toContain('FAIL');
      expect(result.errors![0]).toContain('Account creation date is too recent');
    });


    it('should throw error when account is not found', async () => {
      const summary = {
        totalRows: 1,
        successCount: 1,
        errorCount: 0,
        warningCount: 0,
        results: [
          {
            rowNumber: 1,
            success: true,
            transaction: {
              date: '2026-03-01',
              amount: -50.0,
              label: 'TEST',
              type: 'expense' as const,
            },
          },
        ],
      };

      const request: ConfirmImportRequest = {
        summary,
        accountId: 'non-existent-account',
        autoMapCategories: false,
        skipDuplicateCheck: true,
      };

      await expect(
        serviceWithMocks.confirmImport('user-1', request),
      ).rejects.toThrow('Account');
    });
  });
});
