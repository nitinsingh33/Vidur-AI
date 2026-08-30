import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/**
 * Blocks the demo endpoints in a production deployment unless DEMO_MODE is
 * explicitly opted into (e.g. for a live judged demonstration). This never
 * gates auth (JwtAuthGuard still applies) — it only gates whether the demo
 * surface exists at all in a given environment.
 */
@Injectable()
export class DemoModeGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const isProduction = process.env.NODE_ENV === 'production';
    const demoModeEnabled = process.env.DEMO_MODE === 'true';

    if (isProduction && !demoModeEnabled) {
      throw new ForbiddenException(
        'Demo endpoints are disabled in this environment. Set DEMO_MODE=true to enable them.',
      );
    }

    return true;
  }
}
