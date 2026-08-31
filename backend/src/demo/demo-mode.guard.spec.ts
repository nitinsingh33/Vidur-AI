import { ForbiddenException } from '@nestjs/common';
import { DemoModeGuard } from './demo-mode.guard';

describe('DemoModeGuard', () => {
  const guard = new DemoModeGuard();
  const originalNodeEnv = process.env.NODE_ENV;
  const originalDemoMode = process.env.DEMO_MODE;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.DEMO_MODE = originalDemoMode;
  });

  it('allows demo requests outside production', () => {
    process.env.NODE_ENV = 'development';
    process.env.DEMO_MODE = undefined;

    expect(guard.canActivate({} as any)).toBe(true);
  });

  it('blocks demo requests in production without an explicit opt-in', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = undefined;

    expect(() => guard.canActivate({} as any)).toThrow(ForbiddenException);
  });

  it('allows demo requests in production when DEMO_MODE=true is set for a live judged demo', () => {
    process.env.NODE_ENV = 'production';
    process.env.DEMO_MODE = 'true';

    expect(guard.canActivate({} as any)).toBe(true);
  });
});
