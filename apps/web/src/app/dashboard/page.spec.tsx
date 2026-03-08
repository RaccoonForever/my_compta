import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import DashboardPage from './page';
import * as api from '@/lib/api';

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
  Line: () => null,
  ReferenceLine: () => (
    <div data-testid="today-line" />
  ),
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getDashboardFromAccounts: vi.fn(),
    getTransactions: vi.fn(),
  };
});

const mockGetDashboardFromAccounts = vi.mocked(api.getDashboardFromAccounts);
const mockGetTransactions = vi.mocked(api.getTransactions);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardPage />
    </QueryClientProvider>,
  );
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders total cash and computed account balances (opening + transactions)', async () => {
    mockGetDashboardFromAccounts.mockResolvedValue({
      totalCash: 1630,
      baseCurrency: 'CHF',
      endOfMonthProjection: 1700,
      mtd: { income: 200, expenses: 70 },
      accounts: [
        {
          id: 'acc-1',
          name: 'Main',
          type: 'bank',
          currency: 'CHF',
          balance: 1000,
          isArchived: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'acc-2',
          name: 'Savings',
          type: 'bank',
          currency: 'CHF',
          balance: 500,
          isArchived: false,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      ],
      forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 },
      categoryBreakdown: [],
    });

    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 200,
        currency: 'CHF',
        type: 'income',
        date: '2024-03-01T00:00:00.000Z',
        label: 'Salary',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        amount: 50,
        currency: 'CHF',
        type: 'expense',
        date: '2024-03-02T00:00:00.000Z',
        label: 'Groceries',
      },
      {
        id: 'tx-3',
        accountId: 'acc-2',
        amount: 20,
        currency: 'CHF',
        type: 'expense',
        date: '2024-03-03T00:00:00.000Z',
        label: 'Fee',
      },
    ] as any);

    renderPage();

    await waitFor(() => {
      expect(mockGetDashboardFromAccounts).toHaveBeenCalled();
      expect(mockGetTransactions).toHaveBeenCalledWith({ limit: '1000' });
    });

    const totalCashFormatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CHF',
      currencyDisplay: 'code',
    }).format(1630);

    const mainBalanceFormatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CHF',
      currencyDisplay: 'code',
    }).format(1150);

    const savingsBalanceFormatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CHF',
      currencyDisplay: 'code',
    }).format(480);

    expect(screen.getByText('Total Cash')).toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        normalizeWhitespace(element?.textContent ?? '') === normalizeWhitespace(totalCashFormatted),
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Savings')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByText((_, element) =>
          normalizeWhitespace(element?.textContent ?? '') === normalizeWhitespace(mainBalanceFormatted),
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText((_, element) =>
          normalizeWhitespace(element?.textContent ?? '') === normalizeWhitespace(savingsBalanceFormatted),
        ),
      ).toBeInTheDocument();
    });
  });

  it('renders loading then error state when dashboard query fails', async () => {
    mockGetDashboardFromAccounts.mockRejectedValue(new Error('network error'));
    mockGetTransactions.mockResolvedValue([] as any);

    renderPage();

    expect(screen.getByText('Loading…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard.')).toBeInTheDocument();
    });
  });

  it('renders a today reference line in the chart', async () => {
    mockGetDashboardFromAccounts.mockResolvedValue({
      totalCash: 0,
      baseCurrency: 'CHF',
      endOfMonthProjection: 0,
      mtd: { income: 0, expenses: 0 },
      accounts: [],
      forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 },
      categoryBreakdown: [],
    });

    mockGetTransactions.mockResolvedValue([] as any);

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('today-line')).toBeInTheDocument();
    });
  });

  it('does not include transactions before account creation date in account card balance', async () => {
    mockGetDashboardFromAccounts.mockResolvedValue({
      totalCash: 1000,
      baseCurrency: 'CHF',
      endOfMonthProjection: 1000,
      mtd: { income: 0, expenses: 0 },
      accounts: [
        {
          id: 'acc-1',
          name: 'Main',
          type: 'bank',
          currency: 'CHF',
          balance: 1000,
          isArchived: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 },
      categoryBreakdown: [],
    });

    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-old',
        accountId: 'acc-1',
        amount: 300,
        currency: 'CHF',
        type: 'income',
        date: '2024-03-01T00:00:00.000Z',
        label: 'Old income',
      },
    ] as any);

    renderPage();

    const openingBalanceFormatted = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'CHF',
      currencyDisplay: 'code',
    }).format(1000);

    await waitFor(() => {
      const accountCard = screen.getByText('Main').closest('div');
      expect(accountCard).toBeTruthy();
      expect(
        within(accountCard as HTMLElement).getByText((_, element) =>
          normalizeWhitespace(element?.textContent ?? '') === normalizeWhitespace(openingBalanceFormatted),
        ),
      ).toBeInTheDocument();
    });
  });
});
