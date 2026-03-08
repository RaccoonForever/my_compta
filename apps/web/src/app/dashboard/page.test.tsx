import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import DashboardPage from './page';

const mocks = vi.hoisted(() => ({
  getAccounts: vi.fn(),
  getAccountDetail: vi.fn(),
  getTransactions: vi.fn(),
  lineChartData: null as unknown,
}));

vi.mock('@/lib/api', () => ({
  getAccounts: mocks.getAccounts,
  getAccountDetail: mocks.getAccountDetail,
  getTransactions: mocks.getTransactions,
  getDashboardFromAccounts: async () => {
    const accounts = await mocks.getAccounts();
    const accountDetails = await Promise.all(accounts.map((acc: any) => mocks.getAccountDetail(acc.id)));

    let totalCash = 0;
    let endOfMonthProjection = 0;
    let totalMtdIncome = 0;
    let totalMtdExpenses = 0;
    const categoryBreakdownMap = new Map<string | null, number>();

    accountDetails.forEach((detail: any) => {
      if (detail) {
        totalCash += detail.currentBalance;
        endOfMonthProjection += detail.endOfMonthProjection;
        totalMtdIncome += detail.mtd.income;
        totalMtdExpenses += detail.mtd.expenses;

        detail.categoryBreakdown.forEach((item: any) => {
          const key = item.categoryId ?? null;
          categoryBreakdownMap.set(key, (categoryBreakdownMap.get(key) ?? 0) + item.total);
        });
      }
    });

    return {
      totalCash,
      baseCurrency: accountDetails[0]?.baseCurrency ?? 'CHF',
      endOfMonthProjection,
      mtd: { income: totalMtdIncome, expenses: totalMtdExpenses },
      accounts,
      forecast: accountDetails[0]?.forecast ?? { points: [], markers: [], lowestPointDate: '', lowestBalance: 0 },
      categoryBreakdown: Array.from(categoryBreakdownMap.entries()).map(([categoryId, total]) => ({
        categoryId,
        total,
      })),
    };
  },
}));

vi.mock('recharts', () => {
  const Div = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;

  return {
    ResponsiveContainer: Div,
    CartesianGrid: Div,
    XAxis: Div,
    YAxis: Div,
    Tooltip: Div,
    Legend: Div,
    Line: Div,
    ReferenceLine: Div,
    LineChart: ({ data, children }: { data?: unknown; children?: React.ReactNode }) => {
      mocks.lineChartData = data;
      return <div data-testid="line-chart">{children}</div>;
    },
  };
});

function renderWithQueryClient() {
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

describe('DashboardPage', () => {
  beforeEach(() => {
    mocks.lineChartData = null;
    const now = new Date();
    const accountCreatedAt = new Date(now);
    accountCreatedAt.setDate(now.getDate() - 30);
    const incomeDate = new Date(now);
    incomeDate.setDate(now.getDate() - 2);
    incomeDate.setHours(12, 0, 0, 0);
    const expenseDate = new Date(now);
    expenseDate.setDate(now.getDate() - 1);
    expenseDate.setHours(12, 0, 0, 0);

    const accountData = {
      id: 'acc-1',
      name: 'Main account',
      type: 'bank',
      currency: 'CHF',
      balance: 1000,
      isArchived: false,
      createdAt: accountCreatedAt.toISOString(),
      updatedAt: accountCreatedAt.toISOString(),
    };

    mocks.getAccounts.mockResolvedValue([accountData]);
    mocks.getAccountDetail.mockResolvedValue({
      account: {
        id: 'acc-1',
        name: 'Main account',
        currency: 'CHF',
        balance: 1000,
        type: 'bank',
        createdAt: accountCreatedAt.toISOString(),
      },
      baseCurrency: 'CHF',
      currentBalance: 1300,
      endOfMonthProjection: 1600,
      mtd: { income: 500, expenses: 200 },
      forecast: {
        points: [],
        markers: [],
        lowestPointDate: '2026-03-15T00:00:00.000Z',
        lowestBalance: 1000,
      },
      categoryBreakdown: [],
      recentTransactions: [],
    });
    mocks.getTransactions.mockResolvedValue([
      {
        id: 'tx-income',
        accountId: 'acc-1',
        type: 'income',
        amount: 500,
        currency: 'CHF',
        date: incomeDate.toISOString(),
        label: 'Salary',
        createdAt: incomeDate.toISOString(),
        updatedAt: incomeDate.toISOString(),
      },
      {
        id: 'tx-expense',
        accountId: 'acc-1',
        type: 'expense',
        amount: 200,
        currency: 'CHF',
        date: expenseDate.toISOString(),
        label: 'Groceries',
        createdAt: expenseDate.toISOString(),
        updatedAt: expenseDate.toISOString(),
      },
    ]);
  });

  it('renders MTD income from dashboard API response', async () => {
    renderWithQueryClient();

    expect(await screen.findByText('Income MTD')).toBeInTheDocument();
    expect(await screen.findByText(/500/)).toBeInTheDocument();
  });

  it('includes income when computing chart balance points', async () => {
    renderWithQueryClient();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalled();
    });

    await waitFor(() => {
      const points = mocks.lineChartData as Array<{ date: string; balance: number }>;
      const balances = points.map(p => p.balance);
      expect(Math.max(...balances)).toBe(1500);
      expect(balances).toContain(1300);
    });
  });

  it('includes both total balance line and individual account balance line in chart data', async () => {
    renderWithQueryClient();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalled();
    });

    await waitFor(() => {
      const points = mocks.lineChartData as Array<{ [key: string]: unknown }>;
      expect(points.length).toBeGreaterThan(0);

      // Verify every data point has the total balance field
      points.forEach(point => {
        expect(point).toHaveProperty('balance');
        expect(typeof point.balance).toBe('number');
      });

      // Verify every data point has account-specific balance fields
      points.forEach(point => {
        expect(point).toHaveProperty('account_acc-1');
        expect(typeof (point as any)['account_acc-1']).toBe('number');
      });
    });
  });

  it('displays individual account data for multiple accounts', async () => {
    const now = new Date();
    const accountCreatedAt = new Date(now);
    accountCreatedAt.setDate(now.getDate() - 30);

    const acc1Data = {
      id: 'acc-1',
      name: 'Main account',
      type: 'bank',
      currency: 'CHF',
      balance: 1500,
      isArchived: false,
      createdAt: accountCreatedAt.toISOString(),
      updatedAt: accountCreatedAt.toISOString(),
    };

    const acc2Data = {
      id: 'acc-2',
      name: 'Savings account',
      type: 'savings',
      currency: 'CHF',
      balance: 1000,
      isArchived: false,
      createdAt: accountCreatedAt.toISOString(),
      updatedAt: accountCreatedAt.toISOString(),
    };

    mocks.getAccounts.mockResolvedValue([acc1Data, acc2Data]);
    mocks.getAccountDetail.mockImplementation(async (id: string) => {
      if (id === 'acc-1') {
        return {
          account: { id: 'acc-1', name: 'Main account', currency: 'CHF', balance: 1500, type: 'bank', createdAt: accountCreatedAt.toISOString() },
          baseCurrency: 'CHF',
          currentBalance: 1500,
          endOfMonthProjection: 1600,
          mtd: { income: 500, expenses: 200 },
          forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1500 },
          categoryBreakdown: [],
          recentTransactions: [],
        };
      }
      return {
        account: { id: 'acc-2', name: 'Savings account', currency: 'CHF', balance: 1000, type: 'savings', createdAt: accountCreatedAt.toISOString() },
        baseCurrency: 'CHF',
        currentBalance: 1000,
        endOfMonthProjection: 1200,
        mtd: { income: 300, expenses: 100 },
        forecast: { points: [], markers: [], lowestPointDate: '', lowestBalance: 1000 },
        categoryBreakdown: [],
        recentTransactions: [],
      };
    });

    renderWithQueryClient();

    await waitFor(() => {
      expect(mocks.getTransactions).toHaveBeenCalled();
    });

    await waitFor(() => {
      const points = mocks.lineChartData as Array<{ [key: string]: unknown }>;
      expect(points.length).toBeGreaterThan(0);

      // Verify total balance line exists
      points.forEach(point => {
        expect(point).toHaveProperty('balance');
      });

      // Verify both account lines exist
      points.forEach(point => {
        expect(point).toHaveProperty('account_acc-1');
        expect(point).toHaveProperty('account_acc-2');
      });

      // Verify account balances are independent
      const maxAcc1 = Math.max(...points.map(p => ((p as any)['account_acc-1'] || 0) as number));
      const maxAcc2 = Math.max(...points.map(p => ((p as any)['account_acc-2'] || 0) as number));
      expect(maxAcc1).toBeGreaterThan(0);
      expect(maxAcc2).toBeGreaterThan(0);
    });
  });
});
