import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProjectsAnalyticsPage from './page';
import * as api from '@/lib/api';

// ResponsiveContainer requires real dimensions; stub it for jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    ),
  };
});

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getProjects: vi.fn(),
    getProjectAnalytics: vi.fn(),
    getCategories: vi.fn(),
    getAccounts: vi.fn(),
  };
});

const mockGetProjects = vi.mocked(api.getProjects);
const mockGetProjectAnalytics = vi.mocked(api.getProjectAnalytics);
const mockGetCategories = vi.mocked(api.getCategories);
const mockGetAccounts = vi.mocked(api.getAccounts);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProjectsAnalyticsPage />
    </QueryClientProvider>,
  );
}

describe('ProjectsAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetProjects.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'Flat Renovation',
        description: 'Buying and renovating a flat',
        color: '#22c55e',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'proj-2',
        name: 'Archived Project',
        description: 'Historical project',
        color: '#9ca3af',
        isArchived: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
      },
    ] as any);

    mockGetCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Furniture',
        kind: 'expense',
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any);

    mockGetAccounts.mockResolvedValue([
      {
        id: 'acc-1',
        name: 'Main Account',
        type: 'bank',
        currency: 'CHF',
        balance: 1000,
        isArchived: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ] as any);

    mockGetProjectAnalytics.mockResolvedValue({
      projectId: 'proj-1',
      totalIncome: 1000,
      totalExpenses: 650,
      net: 350,
      transactions: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          subcategory: 'Sofas',
          type: 'expense',
          amount: 600,
          currency: 'CHF',
          date: '2026-02-01T00:00:00.000Z',
          label: 'Sofa',
          isForecasted: false,
        },
        {
          id: 'tx-2',
          accountId: 'acc-1',
          type: 'income',
          amount: 1000,
          currency: 'CHF',
          date: '2026-01-15T00:00:00.000Z',
          label: 'Project contribution',
          isForecasted: false,
        },
        {
          id: 'tx-3',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          subcategory: 'Lamps',
          type: 'expense',
          amount: 50,
          currency: 'CHF',
          date: '2026-02-05T00:00:00.000Z',
          label: 'Lamp',
          isForecasted: false,
        },
      ],
    });
  });

  it('loads and displays analytics summary when a project is selected', async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(mockGetProjects).toHaveBeenCalledWith(true);
    });

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Flat Renovation' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Archived Project' })).toBeInTheDocument();
    });

    const projectSelect = screen.getByRole('combobox');
    await user.selectOptions(projectSelect, 'proj-1');

    await waitFor(() => {
      expect(mockGetProjectAnalytics).toHaveBeenCalledWith('proj-1');
    });

    expect(screen.getByText('Total Income')).toBeInTheDocument();
    expect(screen.getByText('Total Expenses')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
    expect(screen.getByText('Sofa')).toBeInTheDocument();
    expect(screen.getByText('Project contribution')).toBeInTheDocument();
    expect(screen.getByText('Lamp')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);

    // Graph toggle panel should be visible
    expect(screen.getByTestId('graph-toggles')).toBeInTheDocument();

    // Charts are hidden by default
    expect(screen.queryByTestId('project-chart')).toBeNull();
    expect(screen.queryByTestId('subcategory-chart')).toBeNull();
    expect(screen.queryByTestId('net-chart')).toBeNull();

    // Enable category chart
    await user.click(screen.getByRole('checkbox', { name: 'Expenses by Category' }));
    expect(screen.getByTestId('project-chart')).toBeInTheDocument();
    expect(screen.getByText('Monthly Expenses by Category')).toBeInTheDocument();

    // Enable subcategory chart
    await user.click(screen.getByRole('checkbox', { name: 'Expenses by Subcategory' }));
    expect(screen.getByTestId('subcategory-chart')).toBeInTheDocument();
    expect(screen.getByText('Monthly Expenses by Subcategory')).toBeInTheDocument();

    // Enable net chart
    await user.click(screen.getByRole('checkbox', { name: 'Monthly Net' }));
    expect(screen.getByTestId('net-chart')).toBeInTheDocument();
    expect(screen.getByText('Monthly Net (Income vs Expenses)')).toBeInTheDocument();

    // Disable category chart again hides it
    await user.click(screen.getByRole('checkbox', { name: 'Expenses by Category' }));
    expect(screen.queryByTestId('project-chart')).toBeNull();

    // Pie charts are hidden by default
    expect(screen.queryByTestId('category-pie')).toBeNull();
    expect(screen.queryByTestId('subcategory-pie')).toBeNull();

    // Enable pie by category
    await user.click(screen.getByRole('checkbox', { name: 'Pie by Category' }));
    expect(screen.getByTestId('category-pie')).toBeInTheDocument();
    // heading inside the pie card
    expect(
      screen.getByTestId('category-pie').querySelector('h3'),
    ).toHaveTextContent('Expenses by Category');

    // Enable pie by subcategory
    await user.click(screen.getByRole('checkbox', { name: 'Pie by Subcategory' }));
    expect(screen.getByTestId('subcategory-pie')).toBeInTheDocument();
    expect(
      screen.getByTestId('subcategory-pie').querySelector('h3'),
    ).toHaveTextContent('Expenses by Subcategory');

    // Disabling hides again
    await user.click(screen.getByRole('checkbox', { name: 'Pie by Category' }));
    expect(screen.queryByTestId('category-pie')).toBeNull();
    // subcategory pie still visible
    expect(screen.getByTestId('subcategory-pie')).toBeInTheDocument();
  });

  it('does not render expense charts when there are no expense transactions even if enabled', async () => {
    mockGetProjectAnalytics.mockResolvedValue({
      projectId: 'proj-1',
      totalIncome: 500,
      totalExpenses: 0,
      net: 500,
      transactions: [
        {
          id: 'tx-inc',
          accountId: 'acc-1',
          type: 'income',
          amount: 500,
          currency: 'CHF',
          date: '2026-01-10T00:00:00.000Z',
          label: 'Grant',
          isForecasted: false,
        },
      ],
    });

    renderPage();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole('option', { name: 'Flat Renovation' })).toBeInTheDocument(),
    );

    await user.selectOptions(screen.getByRole('combobox'), 'proj-1');

    await waitFor(() => expect(mockGetProjectAnalytics).toHaveBeenCalledWith('proj-1'));

    // Enable all charts – expense charts should still be hidden (no expense data)
    await user.click(screen.getByRole('checkbox', { name: 'Expenses by Category' }));
    await user.click(screen.getByRole('checkbox', { name: 'Expenses by Subcategory' }));
    expect(screen.queryByTestId('project-chart')).toBeNull();
    expect(screen.queryByTestId('subcategory-chart')).toBeNull();

    // Net chart should appear (there is income data)
    await user.click(screen.getByRole('checkbox', { name: 'Monthly Net' }));
    expect(screen.getByTestId('net-chart')).toBeInTheDocument();
  });
});
