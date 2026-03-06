import { auth } from './firebase';

const BFF_URL = process.env['NEXT_PUBLIC_BFF_URL'] ?? 'http://localhost:4001';

export interface LinkedTransaction {
  id: string;
  label: string;
  amount: number;
  currency: string;
  date: string;
}

export class CategoryConflictError extends Error {
  constructor(
    message: string,
    public readonly transactions: LinkedTransaction[],
    public readonly total: number,
  ) {
    super(message);
    this.name = 'CategoryConflictError';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const hasBody = options.body !== undefined;
  const res = await fetch(`${BFF_URL}/v1${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    if (res.status === 409 && Array.isArray(err.transactions)) {
      throw new CategoryConflictError(err.message as string, err.transactions as LinkedTransaction[], err.total as number);
    }
    throw new Error(err.message ?? 'API error');
  }
  if (res.status === 204 || res.headers.get('content-length') === '0') return undefined as T;
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

// ── Dashboard ──────────────────────────────────────────────────────────
export const getDashboard = () => request<DashboardResponse>('/dashboard');

// ── Accounts ───────────────────────────────────────────────────────────
export const getAccounts = (includeArchived = false) =>
  request<AccountResponse[]>(`/accounts?includeArchived=${includeArchived}`);
export const getAccountDetail = (id: string) =>
  request<AccountDetailResponse>(`/accounts/${id}/detail`);
export const createAccount = (body: CreateAccountBody) =>
  request<AccountResponse>('/accounts', { method: 'POST', body: JSON.stringify(body) });
export const updateAccount = (id: string, body: Partial<CreateAccountBody>) =>
  request<AccountResponse>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const archiveAccount = (id: string) =>
  request<AccountResponse>(`/accounts/${id}`, { method: 'DELETE' });
export const clearAccountTransactions = (id: string) =>
  request<{ deletedCount: number }>(`/accounts/${id}/transactions`, { method: 'DELETE' });

/**
 * Fetch dashboard data by aggregating AccountDetailService results for all accounts.
 * Replaces the previous getDashboard call to use account-scoped data directly.
 */
export async function getDashboardFromAccounts(): Promise<DashboardResponse> {
  const accounts = await getAccounts();
  if (accounts.length === 0) {
    return {
      totalCash: 0,
      baseCurrency: 'CHF',
      endOfMonthProjection: 0,
      mtd: { income: 0, expenses: 0 },
      accounts: [],
      forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 },
      categoryBreakdown: [],
    };
  }

  const accountDetails = await Promise.all(accounts.map(acc => getAccountDetail(acc.id)));

  // Aggregate data from all accounts
  let totalCash = 0;
  let endOfMonthProjection = 0;
  let totalMtdIncome = 0;
  let totalMtdExpenses = 0;
  const categoryBreakdownMap = new Map<string | null, number>();
  const baseCurrency = accountDetails[0]?.baseCurrency ?? 'CHF';

  accountDetails.forEach(detail => {
    if (detail) {
      totalCash += detail.currentBalance;
      endOfMonthProjection += detail.endOfMonthProjection;
      totalMtdIncome += detail.mtd.income;
      totalMtdExpenses += detail.mtd.expenses;

      // Aggregate category breakdown
      detail.categoryBreakdown.forEach(item => {
        const key = item.categoryId ?? null;
        categoryBreakdownMap.set(key, (categoryBreakdownMap.get(key) ?? 0) + item.total);
      });
    }
  });

  const categoryBreakdown = Array.from(categoryBreakdownMap.entries()).map(([categoryId, total]) => ({
    categoryId,
    total,
  }));

  // Merge forecasts from all accounts (simplified: just take first account's forecast)
  const forecast = accountDetails[0]?.forecast ?? { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 };

  return {
    totalCash,
    baseCurrency,
    endOfMonthProjection,
    mtd: { income: totalMtdIncome, expenses: totalMtdExpenses },
    accounts,
    forecast,
    categoryBreakdown,
  };
}

// ── Transactions ────────────────────────────────────────────────────────
export const getTransactions = (params?: TransactionFilters) => {
  const qs = new URLSearchParams(
    Object.entries(params ?? {}).filter(([, v]) => v !== undefined) as [string, string][],
  ).toString();
  return request<TransactionResponse[]>(`/transactions${qs ? `?${qs}` : ''}`);
};
export const createTransaction = (body: CreateTransactionBody) =>
  request<TransactionResponse>('/transactions', { method: 'POST', body: JSON.stringify(body) });
export const updateTransaction = (id: string, body: Partial<CreateTransactionBody>) =>
  request<TransactionResponse>(`/transactions/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteTransaction = (id: string) =>
  request<void>(`/transactions/${id}`, { method: 'DELETE' });

export const deleteMultipleTransactions = async (ids: string[]) => {
  await Promise.all(ids.map(id => deleteTransaction(id)));
};

export const autocomplete = (q: string) =>
  request<AutocompleteResult[]>(`/transactions/autocomplete?q=${encodeURIComponent(q)}`);

// ── Categories ──────────────────────────────────────────────────────────
export const getCategories = (includeArchived = false) =>
  request<CategoryResponse[]>(`/categories?includeArchived=${includeArchived}`);
export const createCategory = (body: CreateCategoryBody) =>
  request<CategoryResponse>('/categories', { method: 'POST', body: JSON.stringify(body) });
export const updateCategory = (id: string, body: Partial<CreateCategoryBody>) =>
  request<CategoryResponse>(`/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const deleteCategory = (id: string) =>
  request<void>(`/categories/${id}`, { method: 'DELETE' });
export const seedDefaultCategories = () =>
  request<{ seeded: boolean }>('/categories/seed-defaults', { method: 'POST', body: JSON.stringify({}) });

export interface ImportCategoryRow {
  rowNumber: number; category: string; subcategory?: string;
  kind: 'income' | 'expense'; occurrences: number; alreadyExists: boolean;
  selected: boolean; warnings?: string[];
}

export interface CategoryImportSummary {
  totalPairs: number; newCategoriesCount: number; existingPairsCount: number;
  newSubcategoriesCount: number; rows: ImportCategoryRow[];
  groupedByCategory: Array<{ category: string; kind: 'income' | 'expense'; subcategories: Array<{ name: string; exists: boolean }>; count: number; exists: boolean; }>;
}

export interface ConfirmCategoryImportResponse {
  categoriesCreated: number; categoriesUpdated: number; categoryIds: string[]; errors?: string[];
}

export const extractCategoriesFromCSV = (csv: string) =>
  request<CategoryImportSummary>('/categories/import/extract', { method: 'POST', body: JSON.stringify({ csv }) });

export const confirmCategoryImport = (rows: ImportCategoryRow[]) =>
  request<ConfirmCategoryImportResponse>('/categories/import/confirm', { method: 'POST', body: JSON.stringify({ rows }) });

// ── Recurring ───────────────────────────────────────────────────────────
export const getRecurringTemplates = () => request<RecurringTemplateResponse[]>('/recurring');
export const createRecurringTemplate = (body: CreateRecurringBody) =>
  request<RecurringTemplateResponse>('/recurring', { method: 'POST', body: JSON.stringify(body) });
export const pauseRecurring = (id: string) =>
  request<RecurringTemplateResponse>(`/recurring/${id}/pause`, { method: 'PATCH' });
export const resumeRecurring = (id: string) =>
  request<RecurringTemplateResponse>(`/recurring/${id}/resume`, { method: 'PATCH' });
export const deleteRecurring = (id: string) =>
  request<void>(`/recurring/${id}`, { method: 'DELETE' });

// ── Analytics ───────────────────────────────────────────────────────────
export const getYearlyEarnings = (year: number) =>
  request<YearlyEarningsResponse>(`/analytics/earnings?year=${year}`);
export const getCategoryExpenses = (year: number, month?: number) =>
  request<CategoryExpensesResponse[]>(
    `/analytics/expenses?year=${year}${month ? `&month=${month}` : ''}`,
  );
export const getNetCashflow = (from: string, to: string) =>
  request<NetCashflowResponse[]>(`/analytics/net-cashflow?from=${from}&to=${to}`);

// ── Settings ────────────────────────────────────────────────────────────
export const getSettings = () => request<UserSettings>('/settings');
export const updateSettings = (body: Partial<UserSettings>) =>
  request<UserSettings>('/settings', { method: 'PATCH', body: JSON.stringify(body) });

// ── Types ────────────────────────────────────────────────────────────────
export interface AccountResponse {
  id: string; name: string; type: string; currency: string;
  balance: number; isArchived: boolean; createdAt: string; updatedAt: string;
}
export interface AccountDetailResponse {
  account: { id: string; name: string; currency: string; balance: number; type: string; createdAt: string };
  baseCurrency: string;
  currentBalance: number;
  endOfMonthProjection: number;
  mtd: { income: number; expenses: number };
  forecast: { points: Array<{ date: string; balance: number }>; markers: Array<{ date: string; label: string; amount: { value: number; currency: string }; source: string }>; lowestPointDate: string; lowestBalance: number };
  categoryBreakdown: Array<{ categoryId: string | null; total: number }>;
  recentTransactions: Array<{ id: string; type: string; amount: number; currency: string; date: string; label: string; categoryId?: string }>;
}
export interface CreateAccountBody {
  name: string; type: string; currency: string; balance?: number; createdAt?: string;
}
export interface TransactionResponse {
  id: string; accountId: string; categoryId?: string; subcategory?: string; type: string;
  amount: number; currency: string; date: string; label: string;
  note?: string;
  createdAt: string; updatedAt: string;
}
export interface CreateTransactionBody {
  amount: number; currency: string; type: string; date: string;
  accountId: string; label: string; categoryId?: string; subcategory?: string; note?: string;
}
export interface TransactionFilters {
  accountId?: string; categoryId?: string; type?: string;
  from?: string; to?: string; limit?: string; afterId?: string;
}
export interface AutocompleteResult {
  label: string; amount?: number; currency?: string; categoryId?: string; type?: string;
}
export interface CategoryResponse {
  id: string; name: string; kind: string; color?: string;
  subcategories?: string[]; isArchived: boolean; createdAt: string;
}
export interface CreateCategoryBody {
  name: string; kind: 'income' | 'expense'; color?: string; subcategories?: string[];
}
export interface RecurringTemplateResponse {
  id: string; label: string; amount: number; currency: string; type: string;
  accountId: string; categoryId?: string; schedule: object;
  nextRunDate: string; status: string; tz: string; createdAt: string; updatedAt: string;
}
export interface CreateRecurringBody {
  label: string; amount: number; currency: string; type: string;
  accountId: string; categoryId?: string; schedule: object; nextRunDate: string; tz?: string;
}
export interface DashboardResponse {
  totalCash: number; baseCurrency: string; endOfMonthProjection: number;
  mtd: { income: number; expenses: number };
  accounts: AccountResponse[];
  forecast: { points: Array<{ date: string; balance: number }>; markers: Array<{ date: string; label: string; amount: { value: number; currency: string }; source: string }>; lowestPointDate: string; lowestBalance: number };
  categoryBreakdown: Array<{ categoryId: string | null; total: number }>;
}
export interface YearlyEarningsResponse {
  year: number; totalIncome: number; totalExpenses: number;
  monthly: Array<{ month: number; income: number; expenses: number }>;
}
export interface CategoryExpensesResponse {
  categoryId: string | null; total: number;
  monthlyBreakdown: Array<{ month: number; total: number }>;
}
export interface NetCashflowResponse {
  month: string; income: number; expenses: number; net: number;
}
export interface UserSettings {
  baseCurrency: string; fxRates: Record<string, number>; privacyMode: boolean;
}

// ── Transaction Import ─────────────────────────────────────────────────
export interface ImportRowResult {
  rowNumber: number;
  success: boolean;
  transaction?: {
    date: string;
    amount: number;
    label: string;
    type: 'income' | 'expense' | 'transfer';
    category?: string;
    subcategory?: string;
    reference?: string;
    notes?: string;
    operationType?: string;
  };
  error?: string;
  warnings?: string[];
  rawRow?: string[];
}

export interface ImportSummary {
  totalRows: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  results: ImportRowResult[];
  issueSummary?: {
    invalidAmounts: number;
    invalidDates: number;
    missingCategories: number;
    otherErrors: number;
  };
}

/**
 * Validate CSV import without committing to database
 * Returns detailed summary of parsing and validation results
 */
export const validateCsvImport = (csvContent: string) =>
  request<ImportSummary>('/transactions/import/validate', {
    method: 'POST',
    body: JSON.stringify({ csvContent }),
  });

/**
 * Confirm and save validated CSV import to database
 * Takes the validated summary and creates transactions
 */
export const confirmCsvImport = (importRequest: {
  summary: ImportSummary;
  accountId: string;
  autoMapCategories?: boolean;
  skipDuplicateCheck?: boolean;
}) =>
  request<{
    createdCount: number;
    skippedCount: number;
    failedCount: number;
    transactionIds: string[];
    errors?: string[];
  }>('/transactions/import/confirm', {
    method: 'POST',
    body: JSON.stringify(importRequest),
  });

