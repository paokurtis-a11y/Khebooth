import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

@Injectable()
export class SocialCredentialCipher {
  private key(): Buffer {
    const source = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim() || process.env.JWT_SECRET?.trim();
    if (!source || source.length < 24) {
      throw new InternalServerErrorException('KHE social token encryption is not configured');
    }
    return createHash('sha256').update(`khe-social-token-v1:${source}`, 'utf8').digest();
  }

  encrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  decrypt(value: string | null | undefined): string | null {
    if (!value) return null;
    const [version, ivValue, tagValue, encryptedValue] = value.split('.');
    if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
      throw new InternalServerErrorException('Invalid KHE social credential envelope');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(ivValue, 'base64url'));
      decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
      return Buffer.concat([
        decipher.update(Buffer.from(encryptedValue, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      throw new InternalServerErrorException('Unable to decrypt KHE social credential');
    }
  }
}
