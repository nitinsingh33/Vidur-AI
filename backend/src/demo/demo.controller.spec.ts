import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DemoModeGuard } from './demo-mode.guard';
import { DemoController } from './demo.controller';

describe('DemoController', () => {
  it('is protected by JwtAuthGuard so unauthenticated requests cannot trigger or reset demo data', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      DemoController,
    );

    expect(guards).toContain(JwtAuthGuard);
    expect(guards).toContain(DemoModeGuard);
  });
});
