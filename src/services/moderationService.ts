import { debugLogger } from '../lib/debugLogger';
import { api } from '../lib/api';

export interface ModerationResult {
  isAllowed: boolean;
  violationType?: 'adult_content' | 'harassment' | 'external_contact' | 'spam' | 'profanity';
  severity: 'low' | 'medium' | 'high';
  reason?: string;
  suggestedAction: 'allow' | 'warn' | 'block' | 'escalate';
}

class ModerationService {
  private readonly adultKeywords = ['sex', 'porn', 'xxx', 'nude', 'naked', 'jinsiy', 'yalangʻoch'];
  private readonly harassmentKeywords = ['stupid', 'idiot', 'hate', 'kill', 'ahmoq', 'jinni', 'oʻldiraman'];
  private readonly contactPatterns = [/\b\d{9,}\b/, /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, /telegram|whatsapp|viber|instagram|facebook/i, /t\.me|wa\.me/i];
  private readonly profanityWords = ['damn', 'hell', 'shit', 'fuck', 'bitch', 'jinni', 'harom'];

  async moderateMessage(userId: string, message: string): Promise<ModerationResult> {
    const lowerMessage = message.toLowerCase();
    if (this.containsAdultContent(lowerMessage)) {
      await this.recordViolation(userId, 'adult_content', message);
      return { isAllowed: false, violationType: 'adult_content', severity: 'high', reason: 'Xabaringizda nomaqbul kontent aniqlandi', suggestedAction: 'block' };
    }
    if (this.containsHarassment(lowerMessage)) {
      await this.recordViolation(userId, 'harassment', message);
      return { isAllowed: false, violationType: 'harassment', severity: 'high', reason: 'Xabaringizda tahdid yoki haqorat aniqlandi', suggestedAction: 'block' };
    }
    if (this.containsExternalContact(message)) {
      await this.recordViolation(userId, 'external_contact', message);
      return { isAllowed: false, violationType: 'external_contact', severity: 'medium', reason: "Platformadan tashqari aloqa ma'lumotlari taqiqlangan", suggestedAction: 'warn' };
    }
    if (this.containsProfanity(lowerMessage)) {
      await this.recordViolation(userId, 'profanity', message);
      return { isAllowed: false, violationType: 'profanity', severity: 'medium', reason: 'Xabaringizda nomaqbul soʻzlar aniqlandi', suggestedAction: 'warn' };
    }
    return { isAllowed: true, severity: 'low', suggestedAction: 'allow' };
  }

  private containsAdultContent(text: string) { return this.adultKeywords.some((k) => text.includes(k)); }
  private containsHarassment(text: string) { return this.harassmentKeywords.some((k) => text.includes(k)); }
  private containsProfanity(text: string) { return this.profanityWords.some((k) => text.includes(k)); }
  private containsExternalContact(text: string) { return this.contactPatterns.some((p) => p.test(text)); }

  async recordViolation(userId: string, violationType: string, message: string) {
    await api.violations.create({ userId, violationType, message, action: 'recorded' });
    try {
      const user = await api.users.get(userId);
      await api.users.update(userId, {
        violationCount: (user.violationCount || 0) + 1,
        riskScore: (user.riskScore || 0) + 10,
      });
    } catch (e) {
      debugLogger.error('recordViolation user update', e);
    }
  }

  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const user = await api.users.get(userId);
      if (!user.isBlocked) return false;
      if (user.blockUntil && new Date(String(user.blockUntil)) < new Date()) {
        await api.users.update(userId, { isBlocked: false, blockUntil: undefined, blockReason: undefined });
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}

export const moderationService = new ModerationService();
