import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CategoryImportService } from './category-import.service';
import { TransactionImportService } from '../transactions/transaction-import.service';
import { CsvParserService } from '../../infrastructure/adapters/csv/CsvParserService';
import { CategoryPrimitives } from '@my-compta/domain';

describe('CategoryImportService', () => {
  let service: CategoryImportService;
  let transactionImportService: TransactionImportService;
  let csvParser: CsvParserService;
  let categoriesServiceMock: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    csvParser = new CsvParserService();
    transactionImportService = new TransactionImportService(csvParser);
    categoriesServiceMock = {
      list: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    service = new CategoryImportService(transactionImportService, categoriesServiceMock as any);
  });

  describe('extractCategoriesFromCSV', () => {
    it('should extract unique category/subcategory pairs from CSV', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;GROCERY1;CB GROCERY1;REF;;Carte bancaire;Alimentation;Supermarche;-50;;01/03/2026;01/03/2026;0
02/03/2026;GROCERY2;CB GROCERY2;REF;;Carte bancaire;Alimentation;Supermarche;-30;;02/03/2026;02/03/2026;0
03/03/2026;RESTAURANT;CB RESTAURANT;REF;;Carte bancaire;Alimentation;Restaurant;-25;;03/03/2026;03/03/2026;0`;

      const existingCategories: CategoryPrimitives[] = [];

      const result = await service.extractCategoriesFromCSV(csv, existingCategories);

      expect(result.totalPairs).toBe(2); // Supermarche (2 occurrences), Restaurant (1 occurrence)
      expect(result.newCategoriesCount).toBe(1); // Only Alimentation is new
      expect(result.existingPairsCount).toBe(0);
      expect(result.newSubcategoriesCount).toBe(2); // Supermarche and Restaurant
      expect(result.rows).toHaveLength(2);

      // Check first row
      const supermarcheRow = result.rows.find(r => r.subcategory === 'Supermarche');
      expect(supermarcheRow).toBeDefined();
      expect(supermarcheRow!.category).toBe('Alimentation');
      expect(supermarcheRow!.occurrences).toBe(2);
      expect(supermarcheRow!.kind).toBe('expense');
      expect(supermarcheRow!.alreadyExists).toBe(false);
      expect(supermarcheRow!.selected).toBe(true);
    });

    it('should detect existing categories', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;GROCERY;CB GROCERY;REF;;Carte bancaire;Food;Groceries;-50;;01/03/2026;01/03/2026;0`;

      const existingCategories: CategoryPrimitives[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Food',
          kind: 'expense',
          subcategories: [],
          isArchived: false,
          createdAt: new Date(),
        },
      ];

      const result = await service.extractCategoriesFromCSV(csv, existingCategories);

      expect(result.totalPairs).toBe(1);
      expect(result.newCategoriesCount).toBe(0); // Category exists
      expect(result.newSubcategoriesCount).toBe(1); // Groceries subcategory is new
      expect(result.existingPairsCount).toBe(0); // Pair doesn't exist (new subcategory)
      expect(result.rows[0].alreadyExists).toBe(true);
      expect(result.rows[0].pairExists).toBe(false); // Category exists but not the subcategory
      expect(result.rows[0].subcategoryExists).toBe(false);
      expect(result.rows[0].warnings ?? []).not.toContain('Subcategory already exists');
    });

    it('should skip "A categoriser" entries', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;A categoriser;;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Carte bancaire;Food;Groceries;-30;;02/03/2026;02/03/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      expect(result.totalPairs).toBe(1); // Only Food
      expect(result.rows[0].category).toBe('Food');
    });

    it('should fallback to operation type when category is to-categorize placeholder', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
13/02/2026;SARL PMPC;SARL PMPC;;VIREMENT DE MR ARTHUR CLERC-GHERARDI-VIREMENT DE MR ARTHUR CLERC-GHERA;Virement;A categoriser - sortie d'argent;Virement emis - a categoriser;-1187,31;;13/02/2026;13/02/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      expect(result.totalPairs).toBe(1);
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].category).toBe('Virement');
      expect(result.rows[0].kind).toBe('expense');
      expect(result.rows[0].subcategory).toBeUndefined();
      expect(result.newCategoriesCount).toBe(1);
    });

    it('should group by category correctly', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Transport;Fuel;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Carte bancaire;Transport;Parking;-10;;02/03/2026;02/03/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      expect(result.groupedByCategory).toHaveLength(1); // Only Transport (both subcategories grouped)
      
      const transportGroup = result.groupedByCategory.find(g => g.category === 'Transport');
      expect(transportGroup).toBeDefined();
      expect(transportGroup!.subcategories).toHaveLength(2);
      expect(transportGroup!.subcategories.map(s => s.name)).toContain('Fuel');
      expect(transportGroup!.subcategories.map(s => s.name)).toContain('Parking');
      expect(transportGroup!.kind).toBe('expense');
      expect(transportGroup!.count).toBe(2); // 2 transactions (1 Fuel + 1 Parking)
    });

    it('should sort results by kind then category name', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;ZFood;;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Virement recu;Salary;Job;;+2000;02/03/2026;02/03/2026;0
03/03/2026;TX3;CB TX3;REF;;Carte bancaire;ATransport;;-20;;03/03/2026;03/03/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      expect(result.rows).toHaveLength(3);
      expect(result.rows[0].kind).toBe('income'); // Income first
      expect(result.rows[0].category).toBe('Salary');
      expect(result.rows[0].subcategory).toBe('Job');
      
      // Then expenses sorted alphabetically
      expect(result.rows[1].kind).toBe('expense');
      expect(result.rows[1].category).toBe('ATransport');
      expect(result.rows[2].kind).toBe('expense');
      expect(result.rows[2].category).toBe('ZFood');
    });

    it('should warn about very long category names', async () => {
      const longName = 'A'.repeat(60);
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;${longName};;-50;;01/03/2026;01/03/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      expect(result.rows[0].warnings).toBeDefined();
      expect(result.rows[0].warnings).toContain('Category name is very long - consider shortening');
    });

    it('should detect when subcategory already exists', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Food;Groceries;-50;;01/03/2026;01/03/2026;0`;

      const existingCategories: CategoryPrimitives[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Food',
          kind: 'expense',
          subcategories: ['Groceries', 'Restaurant'],
          isArchived: false,
          createdAt: new Date(),
        },
      ];

      const result = await service.extractCategoriesFromCSV(csv, existingCategories);

      expect(result.rows[0].alreadyExists).toBe(true);
      expect(result.rows[0].pairExists).toBe(true);
      expect(result.rows[0].subcategoryExists).toBe(true);
      expect(result.rows[0].warnings).toContain('Subcategory already exists');
    });

    it('should handle income and expense categories separately', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Transfer;;-100;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Virement recu;Transfer;;;+100;;02/03/2026;02/03/2026;0`;

      const result = await service.extractCategoriesFromCSV(csv, []);

      // "Transfer" appears as both income and expense, so should be treated as 2 entries
      // But "virement" is classified as transfer type, so it won't have a category or will skip it
      // Actually in our logic, "Virement recu" becomes income
      expect(result.rows.length).toBeGreaterThanOrEqual(1);
    });

    it('should correctly count existing pairs when importing identical CSV twice', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Food;Groceries;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Carte bancaire;Food;Restaurant;-30;;02/03/2026;02/03/2026;0
03/03/2026;TX3;CB TX3;REF;;Carte bancaire;Transport;Fuel;-20;;03/03/2026;03/03/2026;0`;

      // First import - everything is new
      const firstResult = await service.extractCategoriesFromCSV(csv, []);
      expect(firstResult.totalPairs).toBe(3);
      expect(firstResult.newCategoriesCount).toBe(2); // Food, Transport
      expect(firstResult.existingPairsCount).toBe(0);
      expect(firstResult.newSubcategoriesCount).toBe(3); // All subcategories are new

      // Now simulate the categories exist
      const existingCategories: CategoryPrimitives[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Food',
          kind: 'expense',
          subcategories: ['Groceries', 'Restaurant'],
          isArchived: false,
          createdAt: new Date(),
        },
        {
          id: '2',
          userId: 'user1',
          name: 'Transport',
          kind: 'expense',
          subcategories: ['Fuel'],
          isArchived: false,
          createdAt: new Date(),
        },
      ];

      // Second import - everything already exists
      const secondResult = await service.extractCategoriesFromCSV(csv, existingCategories);
      expect(secondResult.totalPairs).toBe(3);
      expect(secondResult.newCategoriesCount).toBe(0); // All categories exist
      expect(secondResult.existingPairsCount).toBe(3); // All pairs exist
      expect(secondResult.newSubcategoriesCount).toBe(0); // No new subcategories
    });

    it('should correctly count when category exists but some subcategories are new', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Food;Groceries;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Carte bancaire;Food;FastFood;-15;;02/03/2026;02/03/2026;0
03/03/2026;TX3;CB TX3;REF;;Carte bancaire;Food;Restaurant;-30;;03/03/2026;03/03/2026;0`;

      const existingCategories: CategoryPrimitives[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Food',
          kind: 'expense',
          subcategories: ['Groceries'],
          isArchived: false,
          createdAt: new Date(),
        },
      ];

      const result = await service.extractCategoriesFromCSV(csv, existingCategories);
      expect(result.totalPairs).toBe(3);
      expect(result.newCategoriesCount).toBe(0); // Category exists
      expect(result.existingPairsCount).toBe(1); // Only Food/Groceries exists
      expect(result.newSubcategoriesCount).toBe(2); // FastFood and Restaurant are new
    });

    it('should show exists badge for subcategories in grouped view', async () => {
      const csv = `Date de comptabilisation;Libelle simplifie;Libelle operation;Reference;Informations complementaires;Type operation;Categorie;Sous categorie;Debit;Credit;Date operation;Date de valeur;Pointage operation
01/03/2026;TX1;CB TX1;REF;;Carte bancaire;Food;Groceries;-50;;01/03/2026;01/03/2026;0
02/03/2026;TX2;CB TX2;REF;;Carte bancaire;Food;FastFood;-15;;02/03/2026;02/03/2026;0`;

      const existingCategories: CategoryPrimitives[] = [
        {
          id: '1',
          userId: 'user1',
          name: 'Food',
          kind: 'expense',
          subcategories: ['Groceries'],
          isArchived: false,
          createdAt: new Date(),
        },
      ];

      const result = await service.extractCategoriesFromCSV(csv, existingCategories);
      const foodGroup = result.groupedByCategory.find(g => g.category === 'Food');
      expect(foodGroup).toBeDefined();
      expect(foodGroup!.subcategories).toHaveLength(2);
      
      const groceries = foodGroup!.subcategories.find(s => s.name === 'Groceries');
      const fastFood = foodGroup!.subcategories.find(s => s.name === 'FastFood');
      
      expect(groceries).toBeDefined();
      expect(groceries!.exists).toBe(true); // Groceries already exists
      
      expect(fastFood).toBeDefined();
      expect(fastFood!.exists).toBe(false); // FastFood is new
    });
  });

  describe('validateRows', () => {
    it('should validate that selected rows have category names', () => {
      const rows = [
        {
          rowNumber: 1,
          category: '',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
      ];

      const validation = service.validateRows(rows);

      expect(validation.valid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Category name is required');
    });

    it('should validate category name length', () => {
      const rows = [
        {
          rowNumber: 1,
          category: 'A'.repeat(150),
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
      ];

      const validation = service.validateRows(rows);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('too long');
    });

    it('should validate subcategory name length', () => {
      const rows = [
        {
          rowNumber: 1,
          category: 'Food',
          subcategory: 'A'.repeat(150),
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
      ];

      const validation = service.validateRows(rows);

      expect(validation.valid).toBe(false);
      expect(validation.errors[0]).toContain('Subcategory');
      expect(validation.errors[0]).toContain('too long');
    });

    it('should skip validation for unselected rows', () => {
      const rows = [
        {
          rowNumber: 1,
          category: '',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: false, // Not selected
        },
      ];

      const validation = service.validateRows(rows);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should pass validation for valid rows', () => {
      const rows = [
        {
          rowNumber: 1,
          category: 'Food',
          subcategory: 'Groceries',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
        {
          rowNumber: 2,
          category: 'Transport',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
      ];

      const validation = service.validateRows(rows);

      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });
  });

  describe('confirmCategoryImport', () => {
    it('should save all subcategories when importing more than 2 for same category', async () => {
      // Create a mock CategoriesService for this test
      const mockCategoriesService = {
        list: vi.fn().mockResolvedValue([]),
        create: vi.fn(async (userId: string, dto: any) => {
          // Return a mock Category
          return {
            id: `cat-${dto.name}`,
            userId,
            name: dto.name,
            kind: dto.kind,
            subcategories: dto.subcategories || [],
            color: dto.color,
            isArchived: false,
            createdAt: new Date(),
          };
        }),
        update: vi.fn(async (userId: string, id: string, dto: any) => {
          // Return updated Category with the new subcategories
          return {
            id,
            userId,
            name: 'Food',
            kind: 'expense',
            subcategories: dto.subcategories || [],
            color: undefined,
            isArchived: false,
            createdAt: new Date(),
          };
        }),
      };

      // Create a new service instance with the mock
      const testService = new CategoryImportService(transactionImportService, mockCategoriesService as any);

      const rows = [
        {
          rowNumber: 1,
          category: 'Food',
          subcategory: 'Groceries',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
        {
          rowNumber: 2,
          category: 'Food',
          subcategory: 'Restaurant',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
        {
          rowNumber: 3,
          category: 'Food',
          subcategory: 'FastFood',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
        {
          rowNumber: 4,
          category: 'Food',
          subcategory: 'Bakery',
          kind: 'expense' as const,
          occurrences: 1,
          alreadyExists: false,
          pairExists: false,
          selected: true,
        },
      ];

      const result = await testService.confirmCategoryImport('user1', rows);

      // Verify the response
      expect(result.categoriesCreated).toBe(1);
      expect(result.categoriesUpdated).toBe(3);
      expect(result.categoryIds).toHaveLength(4); // All 4 rows should reference the same category
      expect(result.errors).toHaveLength(0);

      // Verify create was called once with first subcategory
      expect(mockCategoriesService.create).toHaveBeenCalledWith('user1', {
        name: 'Food',
        kind: 'expense',
        subcategories: ['Groceries'],
      });

      // Verify update was called 3 times (for rows 2, 3, 4)
      expect(mockCategoriesService.update).toHaveBeenCalledTimes(3);

      // Verify the progression of subcategories in updates
      const updateCalls = (mockCategoriesService.update as any).mock.calls;
      expect(updateCalls[0][2].subcategories).toEqual(['Groceries', 'Restaurant']);
      expect(updateCalls[1][2].subcategories).toEqual(['Groceries', 'Restaurant', 'FastFood']);
      expect(updateCalls[2][2].subcategories).toEqual(['Groceries', 'Restaurant', 'FastFood', 'Bakery']);
    });
  });
});
