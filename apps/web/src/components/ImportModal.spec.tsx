import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ImportModal, type ImportResult } from './ImportModal';
import * as api from '@/lib/api';

vi.mock('@/lib/api', async () => {
  const actual = await vi.importActual('@/lib/api');
  return {
    ...actual,
    validateCsvImport: vi.fn(),
  };
});

const mockValidateCsvImport = vi.mocked(api.validateCsvImport);

const validSummary: api.ImportSummary = {
  totalRows: 1,
  successCount: 1,
  errorCount: 0,
  warningCount: 0,
  issueSummary: {
    invalidAmounts: 0,
    invalidDates: 0,
    missingCategories: 0,
    otherErrors: 0,
  },
  results: [
    {
      rowNumber: 1,
      success: true,
      transaction: {
        date: '2024-03-01',
        amount: -20,
        label: 'Lunch',
        type: 'expense',
        category: 'Food',
        subcategory: 'Restaurant',
      },
    },
  ],
};

function createCsvFile() {
  return {
    name: 'tx.csv',
    type: 'text/csv',
    text: async () => 'Date;Label\n01/03/2024;Lunch',
  } as unknown as File;
}

describe('ImportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps modal open after successful import and shows actual import result', async () => {
    mockValidateCsvImport.mockResolvedValue(validSummary);
    const onClose = vi.fn();
    const onConfirm = vi.fn<(_: api.ImportSummary) => Promise<ImportResult>>().mockResolvedValue({
      createdCount: 1,
      skippedCount: 0,
      failedCount: 0,
      transactionIds: ['tx-1'],
    });

    render(
      <ImportModal
        isOpen={true}
        accountId="acc-1"
        onClose={onClose}
        onConfirm={onConfirm}
      />, 
    );

    const fileInput = document.querySelector('#csv-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createCsvFile()] } });

    await waitFor(() => {
      expect(screen.getByText('Review Import')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Accept & Import' }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Import Results:')).toBeInTheDocument();
      expect(screen.getByText(/Successfully imported:/)).toBeInTheDocument();
    });

    // Must stay open until user closes
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('Review Import')).toBeInTheDocument();
  });

  it('shows import errors from backend response in review screen', async () => {
    mockValidateCsvImport.mockResolvedValue(validSummary);
    const onClose = vi.fn();
    const onConfirm = vi.fn<(_: api.ImportSummary) => Promise<ImportResult>>().mockResolvedValue({
      createdCount: 0,
      skippedCount: 0,
      failedCount: 1,
      transactionIds: [],
      errors: ['Account creation date is too recent'],
    });

    render(
      <ImportModal
        isOpen={true}
        accountId="acc-1"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const fileInput = document.querySelector('#csv-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createCsvFile()] } });

    await waitFor(() => {
      expect(screen.getByText('Review Import')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Accept & Import' }));

    await waitFor(() => {
      expect(screen.getByText('Error Details:')).toBeInTheDocument();
      expect(screen.getByText(/Account creation date is too recent/)).toBeInTheDocument();
    });
  });

  it('closes when user clicks outside the modal', async () => {
    mockValidateCsvImport.mockResolvedValue(validSummary);
    const onClose = vi.fn();

    render(
      <ImportModal
        isOpen={true}
        accountId="acc-1"
        onClose={onClose}
        onConfirm={vi.fn().mockResolvedValue({
          createdCount: 0,
          skippedCount: 0,
          failedCount: 0,
          transactionIds: [],
        })}
      />,
    );

    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close when clicking inside modal content', async () => {
    mockValidateCsvImport.mockResolvedValue(validSummary);
    const onClose = vi.fn();

    render(
      <ImportModal
        isOpen={true}
        accountId="acc-1"
        onClose={onClose}
        onConfirm={vi.fn().mockResolvedValue({
          createdCount: 0,
          skippedCount: 0,
          failedCount: 0,
          transactionIds: [],
        })}
      />,
    );

    fireEvent.click(screen.getByText('Import Transactions'));

    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows upload error when CSV validation fails', async () => {
    mockValidateCsvImport.mockRejectedValue(new Error('CSV parse error'));

    render(
      <ImportModal
        isOpen={true}
        accountId="acc-1"
        onClose={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue({
          createdCount: 0,
          skippedCount: 0,
          failedCount: 0,
          transactionIds: [],
        })}
      />,
    );

    const fileInput = document.querySelector('#csv-file-input') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [createCsvFile()] } });

    await waitFor(() => {
      expect(screen.getByText('Error processing file:')).toBeInTheDocument();
      expect(screen.getByText('CSV parse error')).toBeInTheDocument();
    });
  });
});
