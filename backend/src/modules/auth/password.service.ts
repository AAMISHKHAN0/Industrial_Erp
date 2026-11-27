import { Injectable, BadRequestException } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  /**
   * Hashes a plaintext password using Argon2id with OWASP-recommended parameters.
   */
  async hashPassword(password: string): Promise<string> {
    return hash(password, {
      memoryCost: 19456, // 19 MiB
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
  }

  /**
   * Verifies a candidate password against an Argon2id hash.
   */
  async verifyPassword(
    hashedPassword: string,
    candidate: string,
  ): Promise<boolean> {
    if (!hashedPassword || !candidate) {
      return false;
    }
    try {
      return await verify(hashedPassword, candidate);
    } catch {
      return false;
    }
  }

  /**
   * Validates password strength according to NIST SP 800-63B / ERP spec.
   * Enforces 8 to 128 characters and rejects common blocklisted passwords.
   */
  validatePasswordStrength(password: string): void {
    if (!password || typeof password !== 'string') {
      throw new BadRequestException('Password is required');
    }
    if (password.length < 8) {
      throw new BadRequestException(
        'Password must be at least 8 characters long',
      );
    }
    if (password.length > 128) {
      throw new BadRequestException('Password must not exceed 128 characters');
    }
    const blocklist = [
      'password',
      'password123',
      'admin123',
      'admin@123',
      '12345678',
      '123456789',
      'letmein123',
      'qwerty123',
    ];
    if (blocklist.includes(password.toLowerCase().trim())) {
      throw new BadRequestException(
        'Password is too common or easily guessable',
      );
    }
  }
}
