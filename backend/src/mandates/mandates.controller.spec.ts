import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../auth/jwt-auth.guard';
import { MandatesController } from './mandates.controller';
import { MandatesService } from './mandates.service';
import { MandateRetrySequencerService } from './mandate-retry-sequencer.service';

describe('MandatesController.delete', () => {
  const mandatesService = {
    delete: jest.fn(),
  } as unknown as MandatesService;

  const sequencerService = {} as unknown as MandateRetrySequencerService;

  function requestAs(user: Partial<AuthenticatedUser>) {
    return { user } as Request & { user: AuthenticatedUser };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects a non-ADMIN merchant user before ever calling the service', () => {
    const controller = new MandatesController(
      mandatesService,
      sequencerService,
    );

    expect(() =>
      controller.delete(
        requestAs({ role: 'OPERATOR', merchantId: 'merchant-1' }),
        'mandate-1',
      ),
    ).toThrow(ForbiddenException);

    expect(mandatesService.delete).not.toHaveBeenCalled();
  });

  it('delegates to the service for an ADMIN, scoped to the caller merchant', () => {
    const controller = new MandatesController(
      mandatesService,
      sequencerService,
    );

    controller.delete(
      requestAs({ role: 'ADMIN', merchantId: 'merchant-1' }),
      'mandate-1',
    );

    expect(mandatesService.delete).toHaveBeenCalledWith(
      'mandate-1',
      'merchant-1',
    );
  });
});
