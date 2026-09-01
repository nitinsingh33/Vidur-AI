import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

describe('SubscriptionsController.delete', () => {
  const subscriptionsService = {
    delete: jest.fn(),
  } as unknown as SubscriptionsService;

  function requestAs(user: Partial<AuthenticatedUser>) {
    return { user } as Request & { user: AuthenticatedUser };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-ADMIN merchant user before ever calling the service', () => {
    const controller = new SubscriptionsController(subscriptionsService);

    expect(() =>
      controller.delete(
        requestAs({ role: 'OPERATOR', merchantId: 'merchant-1' }),
        'sub-1',
      ),
    ).toThrow(ForbiddenException);

    expect(subscriptionsService.delete).not.toHaveBeenCalled();
  });

  it('delegates to the service for an ADMIN, scoped to the caller merchant', () => {
    const controller = new SubscriptionsController(subscriptionsService);

    controller.delete(
      requestAs({ role: 'ADMIN', merchantId: 'merchant-1' }),
      'sub-1',
    );

    expect(subscriptionsService.delete).toHaveBeenCalledWith(
      'sub-1',
      'merchant-1',
    );
  });
});
