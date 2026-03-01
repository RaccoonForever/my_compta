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
export const createAccount = (body: CreateAccountBody) =>
  request<AccountResponse>('/accounts', { method: 'POST', body: JSON.stringify(body) });
export const updateAccount = (id: string, body: Partial<CreateAccountBody>) =>
  request<AccountResponse>(`/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
export const archiveAccount = (id: string) =>
  request<AccountResponse>(`/accounts/${id}`, { method: 'DELETE' });

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
export interface CreateAccountBody {
  name: string; type: string; currency: string; balance?: number; createdAt?: string;
}
export interface TransactionResponse {
  id: string; accountId: string; categoryId?: string; type: string;
  amount: number; currency: string; date: string; label: string;
  note?: string;
  createdAt: string; updatedAt: string;
}
export interface CreateTransactionBody {
  amount: number; currency: string; type: string; date: string;
  accountId: string; label: string; categoryId?: string; note?: string;
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
  isArchived: boolean; createdAt: string;
}
export interface CreateCategoryBody {
  name: string; kind: 'income' | 'expense'; color?: string;
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
