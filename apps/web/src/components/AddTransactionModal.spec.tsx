import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AddTransactionModal } from './AddTransactionModal';
import * as api from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    getSettings: vi.fn(),
    createTransaction: vi.fn(),
    getAccounts: vi.fn(),
    getCategories: vi.fn(),
    getProjects: vi.fn(),
    autocomplete: vi.fn(),
  };
});

const mockGetSettings = vi.mocked(api.getSettings);
const mockCreateTransaction = vi.mocked(api.createTransaction);
const mockGetAccounts = vi.mocked(api.getAccounts);
const mockGetCategories = vi.mocked(api.getCategories);
const mockGetProjects = vi.mocked(api.getProjects);
const mockAutocomplete = vi.mocked(api.autocomplete);

function renderModal() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AddTransactionModal open={true} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('AddTransactionModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetSettings.mockResolvedValue({
      baseCurrency: 'CHF',
      fxRates: { CHF: 1 },
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

    mockGetCategories.mockResolvedValue([
      {
        id: 'cat-1',
        name: 'Food',
        kind: 'expense',
        subcategories: ['Groceries'],
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

    mockAutocomplete.mockResolvedValue([]);
    mockCreateTransaction.mockResolvedValue({ id: 'tx-1' } as any);
  });

  it('keeps income and expense buttons visible after enabling recurring', async () => {
    renderModal();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'income' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'expense' })).toBeVisible();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole('checkbox', { name: 'Recurring transaction' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'income' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'expense' })).toBeVisible();
    });
  });

  it('keeps type selector inside the modal scroll area', async () => {
    renderModal();

    const scrollArea = await screen.findByTestId('add-transaction-scroll-area');
    const typeSelector = await screen.findByTestId('tx-type-selector');

    expect(scrollArea.contains(typeSelector)).toBe(true);
  });

  it('resets modal state after close and reopen', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    function Harness() {
      const [open, setOpen] = useState(true);
      return (
        <QueryClientProvider client={queryClient}>
          <button onClick={() => setOpen(true)}>Open modal</button>
          <AddTransactionModal open={open} onClose={() => setOpen(false)} />
        </QueryClientProvider>
      );
    }

    render(<Harness />);

    const user = userEvent.setup();
    const amountInput = await screen.findByPlaceholderText('0.00');
    const labelInput = await screen.findByPlaceholderText('Label (e.g. Rent)');
    const recurringCheckbox = await screen.findByRole('checkbox', { name: 'Recurring transaction' });

    await user.type(amountInput, '123');
    await user.type(labelInput, 'Salary');
    await user.click(recurringCheckbox);

    await waitFor(() => {
      expect(recurringCheckbox).toBeChecked();
    });

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => {
      expect(screen.queryByText('Add Transaction')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Open modal' }));

    const reopenedAmountInput = await screen.findByPlaceholderText('0.00');
    const reopenedLabelInput = await screen.findByPlaceholderText('Label (e.g. Rent)');
    const reopenedRecurringCheckbox = await screen.findByRole('checkbox', { name: 'Recurring transaction' });

    expect(reopenedAmountInput).toHaveValue(null);
    expect(reopenedLabelInput).toHaveValue('');
    expect(reopenedRecurringCheckbox).not.toBeChecked();
  });

  it('submits selected projectIds when saving', async () => {
    renderModal();
    const user = userEvent.setup();

    const amountInput = await screen.findByPlaceholderText('0.00');
    const labelInput = await screen.findByPlaceholderText('Label (e.g. Rent)');
    const saveButton = screen.getByRole('button', { name: 'Save' });
    const accountSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((opt) => opt.value === 'acc-1'),
    ) as HTMLSelectElement;
    const projectSelect = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((opt) => opt.value === 'proj-1'),
    ) as HTMLSelectElement;

    await user.selectOptions(accountSelect, 'acc-1');
    await user.type(amountInput, '120');
    await user.type(labelInput, 'Tiles');
    await user.selectOptions(projectSelect, 'proj-1');

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });

    await user.click(saveButton);

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalled();
    });

    expect(mockCreateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 120,
        label: 'Tiles',
        projectIds: ['proj-1'],
      }),
    );
  });
});
