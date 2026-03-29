import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TransactionsPage from './page';
import * as api from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getTransactions: vi.fn(),
    deleteMultipleTransactions: vi.fn(),
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    getProjects: vi.fn(),
    updateTransaction: vi.fn(),
    refreshForecastTransactions: vi.fn(),
  };
});

const mockGetTransactions = vi.mocked(api.getTransactions);
const mockGetAccounts = vi.mocked(api.getAccounts);
const mockGetCategories = vi.mocked(api.getCategories);
const mockGetProjects = vi.mocked(api.getProjects);
const mockUpdateTransaction = vi.mocked(api.updateTransaction);
const mockRefreshForecastTransactions = vi.mocked(api.refreshForecastTransactions);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TransactionsPage />
    </QueryClientProvider>,
  );
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAccounts.mockResolvedValue([
      {
        id: 'acc-1',
        name: 'Main Account',
        type: 'bank',
        currency: 'CHF',
        balance: 1000,
        isArchived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ]);

    mockGetCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Food',
        kind: 'expense',
        subcategories: ['Groceries', 'Restaurant'],
        isArchived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
      {
        id: 'cat-2',
        name: 'Salary category',
        kind: 'income',
        subcategories: ['Monthly', 'Bonus'],
        isArchived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ] as any);

    mockGetProjects.mockResolvedValue([
      {
        id: 'proj-1',
        name: 'Flat renovation',
        color: '#22c55e',
        isArchived: false,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
    ] as any);

    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 50,
        currency: 'CHF',
        type: 'expense',
        isForecasted: true,
        date: '2024-02-01T00:00:00.000Z',
        label: 'Groceries',
        categoryId: 'cat-1',
        projectIds: ['proj-1'],
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        amount: 200,
        currency: 'CHF',
        type: 'income',
        isForecasted: false,
        date: '2024-02-02T00:00:00.000Z',
        label: 'Salary',
      },
    ] as any);

    mockUpdateTransaction.mockResolvedValue({
      id: 'tx-2',
      accountId: 'acc-1',
      amount: 200,
      currency: 'CHF',
      type: 'income',
      isForecasted: false,
      date: '2024-02-02T00:00:00.000Z',
      label: 'Salary',
      createdAt: '2024-02-02T00:00:00.000Z',
      updatedAt: '2024-02-02T00:00:00.000Z',
    } as any);

    mockRefreshForecastTransactions.mockResolvedValue({ removedCount: 1 });
  });

  it('refreshes forecast transactions when clicking Refresh Forecast', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Refresh Forecast')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Refresh Forecast'));

    await waitFor(() => {
      expect(mockRefreshForecastTransactions).toHaveBeenCalledTimes(1);
    });
  });

  it('renders forecast column with badge labels', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Forecast').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Forecast').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actual').length).toBeGreaterThan(0);
  });

  it('renders project tags in the projects column', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument();
      expect(screen.getByText('Flat renovation')).toBeInTheDocument();
    });
  });

  it('shows applied filters summary in all transactions tab', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Applied:/)).toBeInTheDocument();
      expect(screen.getByText(/Range:/)).toBeInTheDocument();
    });
  });

  it('shows uncategorized transactions section with only missing categories', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized (2)')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Uncategorized (2)'));

    await waitFor(() => {
      expect(screen.getByTestId('uncategorized-section')).toBeInTheDocument();
    });

    const section = screen.getByTestId('uncategorized-section');
    expect(within(section).getByText('Salary')).toBeInTheDocument();
    expect(within(section).getByText('Groceries')).toBeInTheDocument();
  });

  it('enables edit only when one uncategorized row is selected', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Uncategorized (2)')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByText('Uncategorized (2)'));

    await waitFor(() => {
      expect(screen.getByTestId('uncategorized-section')).toBeInTheDocument();
    });

    const section = screen.getByTestId('uncategorized-section');
    const checkboxes = within(section).getAllByRole('checkbox');

    await user.click(checkboxes[0]!);
    expect(screen.getByText('Edit')).toBeInTheDocument();

    await user.click(checkboxes[1]!);
    expect(screen.queryByText('Edit')).toBeNull();
    expect(screen.getByText('Edit selected')).toBeInTheDocument();
    expect(screen.getByText('Delete 2 selected')).toBeInTheDocument();
  });

  it('bulk edits category, subcategory, and project for all selected rows', async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 50,
        currency: 'CHF',
        type: 'expense',
        isForecasted: true,
        date: '2024-02-01T00:00:00.000Z',
        label: 'Groceries',
      },
      {
        id: 'tx-4',
        accountId: 'acc-1',
        amount: 30,
        currency: 'CHF',
        type: 'expense',
        isForecasted: false,
        date: '2024-02-04T00:00:00.000Z',
        label: 'Restaurant bill',
      },
    ] as any);

    renderPage();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Restaurant bill')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    await user.click(checkboxes[2]!);

    await user.click(screen.getByText('Edit selected'));

    await waitFor(() => {
      expect(screen.getByTestId('bulk-edit-modal')).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText('Category'), 'cat-1');
    await user.selectOptions(screen.getByLabelText('Subcategory'), 'Restaurant');
    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');

    await user.click(screen.getByText('Apply to 2'));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalledTimes(2);
    });

    expect(mockUpdateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-1',
      expect.objectContaining({
        categoryId: 'cat-1',
        subcategory: 'Restaurant',
        projectIds: ['proj-1'],
      }),
    );
    expect(mockUpdateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-4',
      expect.objectContaining({
        categoryId: 'cat-1',
        subcategory: 'Restaurant',
        projectIds: ['proj-1'],
      }),
    );
  });

  it('allows only project changes when mixed income and expense are selected', async () => {
    renderPage();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Salary')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    await user.click(checkboxes[2]!);

    await user.click(screen.getByText('Edit selected'));

    const categorySelect = await screen.findByLabelText('Category');
    const subcategorySelect = screen.getByLabelText('Subcategory');

    expect(categorySelect).toBeDisabled();
    expect(subcategorySelect).toBeDisabled();
    expect(
      screen.getByText('Mixed income and expense selection: category and subcategory cannot be edited together.'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Project'), 'proj-1');
    await user.click(screen.getByText('Apply to 2'));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalledTimes(2);
    });

    expect(mockUpdateTransaction).toHaveBeenNthCalledWith(
      1,
      'tx-1',
      expect.objectContaining({ projectIds: ['proj-1'] }),
    );
    expect(mockUpdateTransaction).toHaveBeenNthCalledWith(
      2,
      'tx-2',
      expect.objectContaining({ projectIds: ['proj-1'] }),
    );
  });

  it('shows only income categories and subcategories when only income rows are selected', async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-2',
        accountId: 'acc-1',
        amount: 200,
        currency: 'CHF',
        type: 'income',
        isForecasted: false,
        date: '2024-02-02T00:00:00.000Z',
        label: 'Salary',
      },
      {
        id: 'tx-3',
        accountId: 'acc-1',
        amount: 120,
        currency: 'CHF',
        type: 'income',
        isForecasted: false,
        date: '2024-02-03T00:00:00.000Z',
        label: 'Bonus',
      },
    ] as any);

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Bonus')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    await user.click(checkboxes[2]!);
    await user.click(screen.getByText('Edit selected'));

    const categorySelect = await screen.findByLabelText('Category');
    expect(within(categorySelect).getByRole('option', { name: 'Salary category' })).toBeInTheDocument();
    expect(within(categorySelect).queryByRole('option', { name: 'Food' })).toBeNull();

    await user.selectOptions(categorySelect, 'cat-2');

    const subcategorySelect = screen.getByLabelText('Subcategory');
    expect(within(subcategorySelect).getByRole('option', { name: 'Monthly' })).toBeInTheDocument();
    expect(within(subcategorySelect).getByRole('option', { name: 'Bonus' })).toBeInTheDocument();
    expect(within(subcategorySelect).queryByRole('option', { name: 'Groceries' })).toBeNull();
  });

  it('shows only expense categories and subcategories when only expense rows are selected', async () => {
    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 50,
        currency: 'CHF',
        type: 'expense',
        isForecasted: true,
        date: '2024-02-01T00:00:00.000Z',
        label: 'Groceries',
      },
      {
        id: 'tx-4',
        accountId: 'acc-1',
        amount: 30,
        currency: 'CHF',
        type: 'expense',
        isForecasted: false,
        date: '2024-02-04T00:00:00.000Z',
        label: 'Restaurant',
      },
    ] as any);

    renderPage();
    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
      expect(screen.getByText('Restaurant')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);
    await user.click(checkboxes[2]!);
    await user.click(screen.getByText('Edit selected'));

    const categorySelect = await screen.findByLabelText('Category');
    expect(within(categorySelect).getByRole('option', { name: 'Food' })).toBeInTheDocument();
    expect(within(categorySelect).queryByRole('option', { name: 'Salary category' })).toBeNull();

    await user.selectOptions(categorySelect, 'cat-1');

    const subcategorySelect = screen.getByLabelText('Subcategory');
    expect(within(subcategorySelect).getByRole('option', { name: 'Groceries' })).toBeInTheDocument();
    expect(within(subcategorySelect).getByRole('option', { name: 'Restaurant' })).toBeInTheDocument();
    expect(within(subcategorySelect).queryByRole('option', { name: 'Monthly' })).toBeNull();
  });

  it('opens edit modal and updates transaction', async () => {
    renderPage();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);

    await user.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    });

    const labelInput = screen.getByPlaceholderText('Label (e.g. Rent)') as HTMLInputElement;
    await user.clear(labelInput);
    await user.type(labelInput, 'Updated');

    const projectSelect = screen.getAllByRole('combobox').find(s =>
      (s as HTMLSelectElement).options[0]?.text === 'No project',
    ) as HTMLSelectElement;
    await user.selectOptions(projectSelect, '');

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalled();
    });

    expect(mockUpdateTransaction).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({ label: 'Updated', projectIds: [] }),
    );
  });

  it('shows subcategory dropdown that depends on selected category', async () => {
    renderPage();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]!);

    await user.click(screen.getByText('Edit'));

    await waitFor(() => {
      expect(screen.getByText('Edit Transaction')).toBeInTheDocument();
    });

    // Get select dropdowns
    const selects = screen.getAllByRole('combobox');
    const subcategorySelect = selects.find(s => 
      (s as HTMLSelectElement).options[0]?.text === 'Subcategory (optional)'
    ) as HTMLSelectElement;
    const categorySelect = selects.find(s => 
      (s as HTMLSelectElement).options[0]?.text === 'Category (optional)'
    ) as HTMLSelectElement;

    // Transaction already has category 'cat-1', so subcategory should be enabled
    expect(subcategorySelect).toBeEnabled();
    expect(within(subcategorySelect).getByText('Groceries')).toBeInTheDocument();
    expect(within(subcategorySelect).getByText('Restaurant')).toBeInTheDocument();

    // Clear category selection
    await user.selectOptions(categorySelect, '');

    // Now subcategory should be disabled
    await waitFor(() => {
      expect(subcategorySelect).toBeDisabled();
    });

    // Select category again
    await user.selectOptions(categorySelect, 'cat-1');

    // Subcategory should be enabled again
    await waitFor(() => {
      expect(subcategorySelect).toBeEnabled();
    });
  });

  it('does not trigger search on filter change until Search button is clicked', async () => {
    renderPage();

    const user = userEvent.setup();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    // Initial call should be made once
    const initialCallCount = mockGetTransactions.mock.calls.length;

    // Find the type filter dropdown
    const allSelects = screen.getAllByRole('combobox');
    const typeSelect = allSelects.find(s => {
      const options = (s as HTMLSelectElement).options;
      return options[0]?.text === 'All types';
    }) as HTMLSelectElement;
    
    expect(typeSelect).toBeDefined();
    await user.selectOptions(typeSelect, 'income');

    // Wait a bit to ensure no new call is made
    await new Promise(resolve => setTimeout(resolve, 100));

    // Should not have triggered a new API call
    expect(mockGetTransactions.mock.calls.length).toBe(initialCallCount);

    // Click Search button
    await user.click(screen.getByText('Search'));

    // Now it should trigger a new call
    await waitFor(() => {
      expect(mockGetTransactions.mock.calls.length).toBe(initialCallCount + 1);
    });

    const lastCallArgs = mockGetTransactions.mock.calls.at(-1)?.[0] as Record<string, string>;
    expect(lastCallArgs?.['type']).toBe('income');
  });

  it('sends selected from/to dates when Search is clicked', async () => {
    renderPage();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(screen.getByText('Groceries')).toBeInTheDocument();
    });

    const dateInputs = screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/) as HTMLInputElement[];
    const fromInput = dateInputs[0];
    const toInput = dateInputs[1];

    await user.clear(fromInput!);
    await user.type(fromInput!, '2025-01-01');
    await user.clear(toInput!);
    await user.type(toInput!, '2025-01-31');

    await user.click(screen.getByText('Search'));

    await waitFor(() => {
      const lastCallArgs = mockGetTransactions.mock.calls.at(-1)?.[0] as Record<string, string>;
      expect(lastCallArgs?.['from']).toBe('2025-01-01');
      expect(lastCallArgs?.['to']).toBe('2025-01-31');
    });
  });
});
