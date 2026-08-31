import { InternalServerErrorException } from '@nestjs/common';
import { CredentialEncryptionService } from './credential-encryption.service';

describe('CredentialEncryptionService', () => {
  let service: CredentialEncryptionService;
  const originalEnv = process.env.CREDENTIALS_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-encryption-key-do-not-use';
    service = new CredentialEncryptionService();
  });

  afterAll(() => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = originalEnv;
  });

  it('round-trips a plaintext secret', () => {
    const plaintext = 'rzp_test_secret_abc123';
    const encrypted = service.encrypt(plaintext);

    expect(encrypted).not.toContain(plaintext);
    expect(service.decrypt(encrypted)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV), same plaintext', () => {
    const a = service.encrypt('same-secret');
    const b = service.encrypt('same-secret');

    expect(a).not.toBe(b);
    expect(service.decrypt(a)).toBe('same-secret');
    expect(service.decrypt(b)).toBe('same-secret');
  });

  it('fails to decrypt with a different encryption key (wrong tenant/key rotation)', () => {
    const encrypted = service.encrypt('merchant-a-secret');

    process.env.CREDENTIALS_ENCRYPTION_KEY = 'a-completely-different-key';
    const otherService = new CredentialEncryptionService();

    expect(() => otherService.decrypt(encrypted)).toThrow();
  });

  it('fails to decrypt a tampered ciphertext (GCM auth tag catches it)', () => {
    const encrypted = service.encrypt('merchant-a-secret');
    const [iv, authTag, ciphertext] = encrypted.split('.');
    const tampered = [iv, authTag, ciphertext.slice(0, -4) + 'abcd'].join('.');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('throws clearly when CREDENTIALS_ENCRYPTION_KEY is not configured', () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    const unconfigured = new CredentialEncryptionService();

    expect(() => unconfigured.encrypt('anything')).toThrow(
      InternalServerErrorException,
    );
  });
});
