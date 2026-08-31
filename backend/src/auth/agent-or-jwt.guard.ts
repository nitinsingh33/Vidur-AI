import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

import { AuthenticatedUser } from './jwt-auth.guard';

/**
 * These routes are called both by the merchant dashboard (with a JWT) and
 * by the Python recovery agent, which has no merchant login of its own —
 * it authenticates with a shared internal token instead.
 */
@Injectable()
export class AgentOrJwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const agentToken = request.headers['x-agent-token'];
    const expectedAgentToken = process.env.AGENT_SERVICE_TOKEN;

    if (
      expectedAgentToken &&
      typeof agentToken === 'string' &&
      agentToken === expectedAgentToken
    ) {
      return true;
    }

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : null;

    if (!token) {
      throw new UnauthorizedException('Missing access token.');
    }

    try {
      request.user =
        await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
  }
}
