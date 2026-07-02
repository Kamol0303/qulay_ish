import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export const passwordService = {
  /**
   * Parolni hash qilish
   */
  async hashPassword(password: string): Promise<string> {
    return await bcrypt.hash(password, SALT_ROUNDS);
  },

  /**
   * Parolni tekshirish
   */
  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
  },

  /**
   * Parol kuchliligini tekshirish
   */
  validatePassword(password: string): { isValid: boolean; error?: string } {
    if (!password || password.length < 8) {
      return { isValid: false, error: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak' };
    }

    if (!/[A-Z]/.test(password)) {
      return { isValid: false, error: 'Parolda kamida 1 ta katta harf bo\'lishi kerak' };
    }

    if (!/[a-z]/.test(password)) {
      return { isValid: false, error: 'Parolda kamida 1 ta kichik harf bo\'lishi kerak' };
    }

    if (!/[0-9]/.test(password)) {
      return { isValid: false, error: 'Parolda kamida 1 ta raqam bo\'lishi kerak' };
    }

    return { isValid: true };
  },
};
