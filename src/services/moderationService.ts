import { debugLogger } from '../lib/debugLogger';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';

export interface ModerationResult {
  isAllowed: boolean;
  violationType?: 'adult_content' | 'harassment' | 'external_contact' | 'spam' | 'profanity';
  severity: 'low' | 'medium' | 'high';
  reason?: string;
  suggestedAction: 'allow' | 'warn' | 'block' | 'escalate';
}

export interface UserViolation {
  userId: string;
  violationType: string;
  message: string;
  timestamp: any;
  action: string;
}

class ModerationService {
  // Patterns for detection
  private readonly adultKeywords = [
    'sex', 'porn', 'xxx', 'nude', 'naked', 'jinsiy', 'yalangʻoch'
  ];

  private readonly harassmentKeywords = [
    'stupid', 'idiot', 'hate', 'kill', 'ahmoq', 'jinni', 'oʻldiraman'
  ];

  private readonly contactPatterns = [
    /\b\d{9,}\b/, // Phone numbers
    /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, // Email
    /telegram|whatsapp|viber|instagram|facebook/i, // Social media
    /t\.me|wa\.me/i // Direct links
  ];

  private readonly profanityWords = [
    'damn', 'hell', 'shit', 'fuck', 'bitch', 'jinni', 'harom'
  ];

  // Moderate message content
  async moderateMessage(userId: string, message: string): Promise<ModerationResult> {
    const lowerMessage = message.toLowerCase();

    // Check for adult content
    if (this.containsAdultContent(lowerMessage)) {
      await this.recordViolation(userId, 'adult_content', message);
      return {
        isAllowed: false,
        violationType: 'adult_content',
        severity: 'high',
        reason: 'Xabaringizda nomaqbul kontent aniqlandi',
        suggestedAction: 'block'
      };
    }

    // Check for harassment
    if (this.containsHarassment(lowerMessage)) {
      await this.recordViolation(userId, 'harassment', message);
      return {
        isAllowed: false,
        violationType: 'harassment',
        severity: 'high',
        reason: 'Xabaringizda tahdid yoki haqorat aniqlandi',
        suggestedAction: 'block'
      };
    }

    // Check for external contact attempts
    if (this.containsExternalContact(message)) {
      await this.recordViolation(userId, 'external_contact', message);
      return {
        isAllowed: false,
        violationType: 'external_contact',
        severity: 'medium',
        reason: 'Platformadan tashqari aloqa ma\'lumotlari taqiqlangan',
        suggestedAction: 'warn'
      };
    }

    // Check for profanity
    if (this.containsProfanity(lowerMessage)) {
      await this.recordViolation(userId, 'profanity', message);
      return {
        isAllowed: true, // Allow but warn
        violationType: 'profanity',
        severity: 'low',
        reason: 'Iltimos, odobli til ishlating',
        suggestedAction: 'warn'
      };
    }

    return {
      isAllowed: true,
      severity: 'low',
      suggestedAction: 'allow'
    };
  }

  private containsAdultContent(message: string): boolean {
    return this.adultKeywords.some(keyword => message.includes(keyword));
  }

  private containsHarassment(message: string): boolean {
    return this.harassmentKeywords.some(keyword => message.includes(keyword));
  }

  private containsExternalContact(message: string): boolean {
    return this.contactPatterns.some(pattern => pattern.test(message));
  }

  private containsProfanity(message: string): boolean {
    return this.profanityWords.some(word => message.includes(word));
  }

  // Record violation
  private async recordViolation(userId: string, violationType: string, message: string) {
    try {
      // Add violation record
      await addDoc(collection(db, 'violations'), {
        userId,
        violationType,
        message,
        timestamp: serverTimestamp()
      });

      // Update user's violation count
      const userRef = doc(db, 'profiles', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const currentCount = userDoc.data().violationCount || 0;
        const newCount = currentCount + 1;
        
        await updateDoc(userRef, {
          violationCount: increment(1),
          riskScore: this.calculateRiskScore(newCount, violationType),
          lastViolation: serverTimestamp()
        });

        // Auto-block if violations exceed threshold
        if (newCount >= 3) {
          await this.blockUser(userId, '24h');
        }
      }
    } catch (error) {
      debugLogger.error('Error recording violation:', error);
    }
  }

  // Calculate risk score
  private calculateRiskScore(violationCount: number, violationType: string): number {
    let baseScore = violationCount * 10;
    
    // Severity multipliers
    const severityMultiplier: Record<string, number> = {
      'adult_content': 3,
      'harassment': 3,
      'external_contact': 2,
      'spam': 1.5,
      'profanity': 1
    };

    return Math.min(100, baseScore * (severityMultiplier[violationType] || 1));
  }

  // Block user temporarily
  private async blockUser(userId: string, duration: '24h' | '7d' | 'permanent') {
    try {
      const blockUntil = duration === 'permanent' 
        ? null 
        : new Date(Date.now() + (duration === '24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000));

      await updateDoc(doc(db, 'profiles', userId), {
        isBlocked: true,
        blockUntil: blockUntil,
        blockReason: 'Qoidalarni bir necha marta buzganlik uchun',
        blockedAt: serverTimestamp()
      });
    } catch (error) {
      debugLogger.error('Error blocking user:', error);
    }
  }

  // Get user violations
  async getUserViolations(userId: string): Promise<number> {
    try {
      const userDoc = await getDoc(doc(db, 'profiles', userId));
      return userDoc.exists() ? (userDoc.data().violationCount || 0) : 0;
    } catch {
      return 0;
    }
  }

  // Check if user is blocked
  async isUserBlocked(userId: string): Promise<boolean> {
    try {
      const userDoc = await getDoc(doc(db, 'profiles', userId));
      if (!userDoc.exists()) return false;

      const data = userDoc.data();
      if (!data.isBlocked) return false;

      // Check if block has expired
      if (data.blockUntil) {
        const blockUntil = data.blockUntil.toDate();
        if (new Date() > blockUntil) {
          // Unblock user
          await updateDoc(doc(db, 'profiles', userId), {
            isBlocked: false,
            blockUntil: null
          });
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}

export const moderationService = new ModerationService();
