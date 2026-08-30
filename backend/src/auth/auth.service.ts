import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DEFAULT_POLICIES } from '../policy/default-policies';

const PASSWORD_SALT_ROUNDS = 10;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private issueToken(user: {
    id: string;
    merchantId: string;
    email: string;
    role: string;
  }) {
    return this.jwtService.sign({
      sub: user.id,
      merchantId: user.merchantId,
      email: user.email,
      role: user.role,
    });
  }

  private toSession(user: {
    id: string;
    name: string;
    email: string;
    role: string;
    merchant: { id: string; name: string };
  }) {
    return {
      accessToken: this.issueToken({
        id: user.id,
        merchantId: user.merchant.id,
        email: user.email,
        role: user.role,
      }),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      merchant: user.merchant,
    };
  }

  async signup(dto: SignupDto) {
    const existing = await this.prisma.merchantUser.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_SALT_ROUNDS);

    const merchant = await this.prisma.merchant.create({
      data: {
        name: dto.merchantName,
        email: dto.email,
      },
    });

    // Without this, PolicyService.check() finds no Policy row for this
    // merchant and blocks every recovery action by default — the agent
    // would escalate instead of ever executing anything.
    await this.prisma.policy.createMany({
      data: DEFAULT_POLICIES.map((policy) => ({
        merchantId: merchant.id,
        name: policy.name,
        description: policy.description,
        actionType: policy.actionType,
        decision: policy.decision,
        maxRetries: policy.maxRetries ?? null,
        maxContacts: policy.maxContacts ?? null,
        maxAmount: policy.maxAmount ?? null,
        enabled: true,
      })),
    });

    const user = await this.prisma.merchantUser.create({
      data: {
        merchantId: merchant.id,
        name: dto.name,
        email: dto.email,
        passwordHash,
        role: 'ADMIN',
      },
      include: { merchant: true },
    });

    return this.toSession(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.merchantUser.findUnique({
      where: { email: dto.email },
      include: { merchant: true },
    });

    const passwordMatches = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return this.toSession(user);
  }

  async me(userId: string) {
    const user = await this.prisma.merchantUser.findUnique({
      where: { id: userId },
      include: { merchant: true },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      merchant: { id: user.merchant.id, name: user.merchant.name },
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.merchantUser.update({
      where: { id: userId },
      data: { name: dto.name },
      include: { merchant: true },
    });

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      merchant: { id: user.merchant.id, name: user.merchant.name },
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.merchantUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Session is no longer valid.');
    }

    const currentMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentMatches) {
      throw new UnauthorizedException('Current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(
      dto.newPassword,
      PASSWORD_SALT_ROUNDS,
    );

    await this.prisma.merchantUser.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true };
  }
}
