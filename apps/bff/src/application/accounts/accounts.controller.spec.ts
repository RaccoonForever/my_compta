import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@nestjs/swagger', () => ({
  ApiBearerAuth: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiPropertyOptional: () => () => undefined,
  ApiQuery: () => () => undefined,
  ApiTags: () => () => undefined,
}), { virtual: true });

import { AccountsController } from './accounts.controller.js';

describe('AccountsController', () => {
  let controller: AccountsController;
  let accountsService: {
    clearTransactions: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    accountsService = {
      clearTransactions: vi.fn(),
    };

    controller = new AccountsController(
      accountsService as any,
      {} as any,
    );
  });

  it('returns deletedCount from clearTransactions endpoint', async () => {
    accountsService.clearTransactions.mockResolvedValue(3);

    const req = { user: { uid: 'user-1' } } as any;
    const result = await controller.clearTransactions(req, 'acc-1');

    expect(accountsService.clearTransactions).toHaveBeenCalledWith('user-1', 'acc-1');
    expect(result).toEqual({ deletedCount: 3 });
  });
});
