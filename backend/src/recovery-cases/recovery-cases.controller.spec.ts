import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { RecoveryCasesController } from './recovery-cases.controller';
import { RecoveryCasesService } from './recovery-cases.service';

describe('RecoveryCasesController.delete', () => {
  const recoveryCasesService = {
    delete: jest.fn(),
  } as unknown as RecoveryCasesService;

  function requestAs(user: Partial<AuthenticatedUser>) {
    return { user } as Request & { user: AuthenticatedUser };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-ADMIN merchant user before ever calling the service', () => {
    const controller = new RecoveryCasesController(recoveryCasesService);

    expect(() =>
      controller.delete(
        requestAs({ role: 'OPERATOR', merchantId: 'merchant-1' }),
        'case-1',
      ),
    ).toThrow(ForbiddenException);

    expect(recoveryCasesService.delete).not.toHaveBeenCalled();
  });

  it('delegates to the service for an ADMIN, scoped to the caller merchant', () => {
    const controller = new RecoveryCasesController(recoveryCasesService);

    controller.delete(
      requestAs({ role: 'ADMIN', merchantId: 'merchant-1' }),
      'case-1',
    );

    expect(recoveryCasesService.delete).toHaveBeenCalledWith(
      'case-1',
      'merchant-1',
    );
  });
});
