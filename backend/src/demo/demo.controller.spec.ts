import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import type { Request } from 'express';
import { AuthenticatedUser, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DemoModeGuard } from './demo-mode.guard';
import { DemoController } from './demo.controller';
import { DemoService } from './demo.service';
import { FashionKartDemoResetService } from './fashionkart-demo-reset.service';

describe('DemoController', () => {
  it('is protected by JwtAuthGuard so unauthenticated requests cannot trigger or reset demo data', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, DemoController);

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(DemoModeGuard);
  });

  describe('resetFashionKart', () => {
    const demoService = {} as unknown as DemoService;
    const fashionKartDemoResetService = {
      reset: jest.fn(),
    } as unknown as FashionKartDemoResetService;

    function requestAs(user: Partial<AuthenticatedUser>) {
      return { user } as Request & { user: AuthenticatedUser };
    }

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('rejects a non-ADMIN merchant user before ever calling the reset service', () => {
      const controller = new DemoController(
        demoService,
        fashionKartDemoResetService,
      );

      expect(() =>
        controller.resetFashionKart(
          requestAs({ role: 'OPERATOR', merchantId: 'fashionkart', sub: 'user-1' }),
        ),
      ).toThrow(ForbiddenException);

      expect(fashionKartDemoResetService.reset).not.toHaveBeenCalled();
    });

    it('delegates to FashionKartDemoResetService for an ADMIN, using merchantId/actorId from the JWT only', async () => {
      (fashionKartDemoResetService.reset as jest.Mock).mockResolvedValue({
        ordersDeleted: 0,
      });

      const controller = new DemoController(
        demoService,
        fashionKartDemoResetService,
      );

      await controller.resetFashionKart(
        requestAs({ role: 'ADMIN', merchantId: 'fashionkart', sub: 'admin-1' }),
      );

      expect(fashionKartDemoResetService.reset).toHaveBeenCalledWith(
        'fashionkart',
        { id: 'admin-1' },
      );
    });
  });
});
