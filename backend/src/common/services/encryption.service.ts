import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  constructor(private readonly configService: ConfigService) {}

  encrypt(plaintext: string): string {
    const key = this.getEncryptionKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `v1:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(payload: string): string {
    const [version, ivHex, authTagHex, ciphertextHex] = payload.split(':');
    if (version !== 'v1' || !ivHex || !authTagHex || !ciphertextHex) {
      throw new InternalServerErrorException('Invalid encrypted payload format');
    }

    const key = this.getEncryptionKey();
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private getEncryptionKey(): Buffer {
    const configured = this.configService.get<string>('credentials.encryptionKey');
    const jwtSecret = this.configService.get<string>('jwt.secret');

    const source = configured?.trim() || jwtSecret;
    if (!source || source.length < 32) {
      throw new InternalServerErrorException(
        'CREDENTIALS_ENCRYPTION_KEY or JWT_SECRET (min 32 chars) is required',
      );
    }

    return createHash('sha256').update(source).digest();
  }
}
