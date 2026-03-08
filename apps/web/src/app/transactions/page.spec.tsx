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
    updateTransaction: vi.fn(),
  };
});

const mockGetTransactions = vi.mocked(api.getTransactions);
const mockGetAccounts = vi.mocked(api.getAccounts);
const mockGetCategories = vi.mocked(api.getCategories);
const mockUpdateTransaction = vi.mocked(api.updateTransaction);

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
  });

  it('renders forecast column with badge labels', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getAllByText('Forecast').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Forecast').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Actual').length).toBeGreaterThan(0);
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
    expect(screen.getByText('Delete 2 selected')).toBeInTheDocument();
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

    await user.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdateTransaction).toHaveBeenCalled();
    });

    expect(mockUpdateTransaction).toHaveBeenCalledWith(
      'tx-1',
      expect.objectContaining({ label: 'Updated' }),
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
