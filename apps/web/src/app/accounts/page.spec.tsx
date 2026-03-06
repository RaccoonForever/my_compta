import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AccountsPage from './page';
import * as api from '@/lib/api';

vi.mock('@/components/ImportModal', () => ({
  ImportModal: () => null,
}));

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getSettings: vi.fn(),
    getAccounts: vi.fn(),
    getTransactions: vi.fn(),
    createAccount: vi.fn(),
    updateAccount: vi.fn(),
    archiveAccount: vi.fn(),
    clearAccountTransactions: vi.fn(),
    confirmCsvImport: vi.fn(),
  };
});

const mockGetSettings = vi.mocked(api.getSettings);
const mockGetAccounts = vi.mocked(api.getAccounts);
const mockGetTransactions = vi.mocked(api.getTransactions);
const mockClearAccountTransactions = vi.mocked(api.clearAccountTransactions);

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountsPage />
    </QueryClientProvider>,
  );
}

describe('AccountsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSettings.mockResolvedValue({
      baseCurrency: 'CHF',
      fxRates: {},
      privacyMode: false,
    });

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

    mockGetTransactions.mockResolvedValue([
      {
        id: 'tx-1',
        accountId: 'acc-1',
        amount: 120,
        currency: 'CHF',
        type: 'income',
        date: '2024-02-01T00:00:00.000Z',
        label: 'Salary',
      },
      {
        id: 'tx-2',
        accountId: 'acc-1',
        amount: 20,
        currency: 'CHF',
        type: 'expense',
        date: '2024-02-02T00:00:00.000Z',
        label: 'Food',
      },
    ] as any);

    mockClearAccountTransactions.mockResolvedValue({ deletedCount: 2 });
  });

  it('calls clearAccountTransactions when user confirms clear transactions', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Main Account')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Clear Transactions' }));

    await waitFor(() => {
      expect(screen.getByText('Clear all transactions for Main Account?')).toBeInTheDocument();
    });

    const clearButtons = screen.getAllByRole('button', { name: 'Clear Transactions' });
    await user.click(clearButtons[clearButtons.length - 1]);

    await waitFor(() => {
      expect(mockClearAccountTransactions).toHaveBeenCalledWith('acc-1');
    });
  });
});
