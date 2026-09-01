import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { InvoiceOverdueSweepService } from './invoice-overdue-sweep.service';

describe('InvoicesController.delete', () => {
  const invoicesService = {
    delete: jest.fn(),
  } as unknown as InvoicesService;

  const sweepService = {} as unknown as InvoiceOverdueSweepService;

  function requestAs(user: Partial<AuthenticatedUser>) {
    return { user } as Request & { user: AuthenticatedUser };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-ADMIN merchant user before ever calling the service', () => {
    const controller = new InvoicesController(invoicesService, sweepService);

    expect(() =>
      controller.delete(
        requestAs({ role: 'OPERATOR', merchantId: 'merchant-1' }),
        'invoice-1',
      ),
    ).toThrow(ForbiddenException);

    expect(invoicesService.delete).not.toHaveBeenCalled();
  });

  it('delegates to the service for an ADMIN, scoped to the caller merchant', () => {
    const controller = new InvoicesController(invoicesService, sweepService);

    controller.delete(
      requestAs({ role: 'ADMIN', merchantId: 'merchant-1' }),
      'invoice-1',
    );

    expect(invoicesService.delete).toHaveBeenCalledWith(
      'invoice-1',
      'merchant-1',
    );
  });
});
