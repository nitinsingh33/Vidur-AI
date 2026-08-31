import { Injectable, InternalServerErrorException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;
const KEY_DERIVATION_SALT = 'vidur-credential-encryption-v1';

/**
 * AES-256-GCM at-rest encryption for merchant-supplied secrets (their own
 * Razorpay Key Secret / Webhook Secret — see Merchant.razorpayKeySecretEncrypted
 * / razorpayWebhookSecretEncrypted). The raw CREDENTIALS_ENCRYPTION_KEY env
 * var can be any length/format — scrypt derives a fixed 32-byte key from it
 * so operators aren't required to generate a key in one exact format.
 *
 * This is a real, working encryption scheme appropriate for this project's
 * scope, not a substitute for a production secrets vault (KMS/Vault) at real
 * production scale — noted here rather than left implicit.
 */
@Injectable()
export class CredentialEncryptionService {
  private getKey(): Buffer {
    const secret = process.env.CREDENTIALS_ENCRYPTION_KEY;

    if (!secret) {
      throw new InternalServerErrorException(
        'CREDENTIALS_ENCRYPTION_KEY is not configured.',
      );
    }

    return scryptSync(secret, KEY_DERIVATION_SALT, 32);
  }

  /** Returns `${iv}.${authTag}.${ciphertext}`, each base64. */
  encrypt(plaintext: string): string {
    const key = this.getKey();
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return [iv, authTag, ciphertext]
      .map((buffer) => buffer.toString('base64'))
      .join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, ciphertextB64] = payload.split('.');

    if (!ivB64 || !authTagB64 || !ciphertextB64) {
      throw new InternalServerErrorException(
        'Malformed encrypted credential payload.',
      );
    }

    const key = this.getKey();
    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivB64, 'base64'),
    );

    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]);

    return plaintext.toString('utf8');
  }
}
