import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CredentialEncryptionService } from '../credential-encryption/credential-encryption.service';
import { RazorpayService } from '../razorpay/razorpay.service';
import { AuditService } from '../audit/audit.service';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { ConnectRazorpayDto } from './dto/connect-razorpay.dto';

/**
 * Fields safe to return from any merchant-facing endpoint. Deliberately
 * excludes razorpayKeySecretEncrypted/razorpayWebhookSecretEncrypted — those
 * never leave the backend once saved. razorpayKeyId is included because it
 * is not secret (Razorpay's own Checkout.js already exposes it client-side).
 */
const SAFE_MERCHANT_SELECT = {
  id: true,
  name: true,
  email: true,
  currency: true,
  createdAt: true,
  razorpayKeyId: true,
} as const;

@Injectable()
export class MerchantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credentialEncryption: CredentialEncryptionService,
    private readonly razorpayService: RazorpayService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.merchant.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async findOne(id: string) {
    const merchant = await this.prisma.merchant.findUniqueOrThrow({
      where: { id },
      select: {
        ...SAFE_MERCHANT_SELECT,
        razorpayKeySecretEncrypted: true,
        razorpayWebhookSecretEncrypted: true,
      },
    });

    const { razorpayKeySecretEncrypted, razorpayWebhookSecretEncrypted, ...safe } =
      merchant;

    return {
      ...safe,
      razorpayConnected: Boolean(
        razorpayKeySecretEncrypted && razorpayWebhookSecretEncrypted,
      ),
    };
  }

  update(id: string, dto: UpdateMerchantDto) {
    return this.prisma.merchant.update({
      where: { id },
      data: { name: dto.name },
      select: { id: true, name: true, email: true },
    });
  }

  /**
   * Verifies the submitted Key ID/Secret against Razorpay itself with a
   * real, minimal API call *before* saving anything — a typo'd or revoked
   * key is rejected immediately rather than silently breaking every future
   * checkout/webhook for this merchant. Only the encrypted secret and the
   * (non-secret) Key ID are ever persisted; the response never echoes the
   * secret or webhook secret back, and neither is ever written to an audit
   * log or a server log line.
   */
  async connectRazorpay(
    merchantId: string,
    actor: { id: string; role: string },
    dto: ConnectRazorpayDto,
  ) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only an admin can connect a Razorpay account.',
      );
    }

    const isValid = await this.razorpayService.verifyCredentials(
      dto.keyId,
      dto.keySecret,
    );

    if (!isValid) {
      throw new BadRequestException(
        'Razorpay rejected these credentials — double-check the Key ID and Key Secret from your Razorpay Dashboard.',
      );
    }

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        razorpayKeyId: dto.keyId,
        razorpayKeySecretEncrypted: this.credentialEncryption.encrypt(
          dto.keySecret,
        ),
        razorpayWebhookSecretEncrypted: this.credentialEncryption.encrypt(
          dto.webhookSecret,
        ),
      },
    });

    // Deliberately no `dto`/secret values in this audit record — only the
    // fact that a connection was made and by whom.
    await this.auditService.record({
      merchantId,
      action: 'RAZORPAY_ACCOUNT_CONNECTED',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: { keyIdSuffix: dto.keyId.slice(-4) },
    });

    return this.findOne(merchantId);
  }

  /**
   * Disconnects a merchant's own Razorpay account — they immediately fall
   * back to Vidur's shared sandbox account (RazorpayService's global-env
   * fallback), with no other change needed.
   */
  async disconnectRazorpay(merchantId: string, actor: { id: string; role: string }) {
    if (actor.role !== 'ADMIN') {
      throw new ForbiddenException(
        'Only an admin can disconnect a Razorpay account.',
      );
    }

    await this.prisma.merchant.update({
      where: { id: merchantId },
      data: {
        razorpayKeyId: null,
        razorpayKeySecretEncrypted: null,
        razorpayWebhookSecretEncrypted: null,
      },
    });

    await this.auditService.record({
      merchantId,
      action: 'RAZORPAY_ACCOUNT_DISCONNECTED',
      actorType: 'HUMAN',
      actorId: actor.id,
      details: {},
    });

    return this.findOne(merchantId);
  }
}
