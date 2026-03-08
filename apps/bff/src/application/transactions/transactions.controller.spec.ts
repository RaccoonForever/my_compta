import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@nestjs/swagger', () => ({
  ApiBearerAuth: () => () => undefined,
  ApiOperation: () => () => undefined,
  ApiProperty: () => () => undefined,
  ApiPropertyOptional: () => () => undefined,
  ApiQuery: () => () => undefined,
  ApiTags: () => () => undefined,
}), { virtual: true });

import { TransactionsController } from './transactions.controller.js';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let transactionsService: {
    list: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    transactionsService = {
      list: vi.fn().mockResolvedValue([]),
    };

    controller = new TransactionsController(
      transactionsService as any,
      {} as any,
    );
  });

  it('normalizes from/to query params to start/end of day', async () => {
    const req = { user: { uid: 'user-1' } } as any;

    await controller.list(
      req,
      undefined,
      undefined,
      undefined,
      '2026-03-01',
      '2026-03-08',
      '50',
      undefined,
    );

    expect(transactionsService.list).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        from: expect.any(Date),
        to: expect.any(Date),
      }),
    );

    const calledFilters = transactionsService.list.mock.calls[0][1];
    expect(calledFilters.from.toISOString()).toContain('T00:00:00.000');
    expect(calledFilters.to.toISOString()).toContain('T23:59:59.999');
  });
});
