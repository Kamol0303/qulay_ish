import { debugLogger } from '../../lib/debugLogger';
import { Job } from '../../types';

/**
 * Unsafe Job Detection Service - AI-ready safety monitor
 * Detects potentially unsafe, discriminatory, or exploitative job postings
 */

export interface SafetyAssessment {
  isSafe: boolean;
  riskLevel: 'safe' | 'warning' | 'dangerous';
  score: number; // 0-100 (100 = safe)
  issues: string[];
  recommendations: string[];
}

// Keywords that may indicate unsafe conditions or exploitation
const UNSAFE_KEYWORDS = {
  exploitation: [
    'ish qilmaslik',
    'nazo',
    'shaxsiy ishlar',
    'sirli',
    'qoidasiz',
    'rasmiy emas',
    'faqat halol',
    'dinga',
    'uydan chiqib ketish',
    'oila bilan',
    'turib qolish'
  ],
  discrimination: [
    'faqat yosh',
    'faqat chekka',
    'faqat jinsiy',
    'shaxs',
    'familya',
    'millat',
    'dini',
    'nisbatan'
  ],
  abuse: [
    'azob',
    'qo\'qon',
    'judiy',
    'xavf',
    'jismoniy',
    'ruhiy',
    'ta\'qtish'
  ],
  underPay: [
    'bepul',
    'ozkorlik',
    'qarz',
    'chiqim',
    'faqat ovqat',
    'faqat joy'
  ]
};

// Red flags in job descriptions
const RED_FLAGS = {
  noPayment: ['bepul', 'to\'lovs', 'sehmat', 'ozkorlik', 'qarz'],
  noContract: ['shartnoma yo\'q', 'rasmiy emas', 'qoidasiz'],
  isolation: ['yalpi', 'uzilgan', 'uzoq', 'faqat'],
  workPermit: ['pasport', 'shaxsiy hujjat', 'haqiqiy ID', 'ID olish'],
  excessive: ['kundalik', '24/7', 'dam qilishsiz', 'hafta-havola'],
  hostage: ['pul', 'hujjat', 'bog\'lanish', 'maxfi']
};

// Reasonable salary thresholds (daily rate in UZS)
const MIN_REASONABLE_SALARY = 25000; // ~2.5$ per day
const MAX_REASONABLE_SALARY = 500000; // ~50$ per day

export const unsafeJobDetectionService = {
  /**
   * Assess safety of a job posting
   */
  assessJobSafety(job: Job): SafetyAssessment {
    const issues: string[] = [];
    let riskScore = 100; // Start with safe score
    const recommendations: string[] = [];

    // Check salary
    if (!job.salary && !job.price) {
      issues.push('Ish haqi ko\'rsatilmagan');
      riskScore -= 15;
      recommendations.push('Ish haqi aniqlang');
    } else if (job.salary || job.price) {
      const salary = (job.salary || job.price) as number;
      if (salary < MIN_REASONABLE_SALARY) {
        issues.push('Ish haqi juda past');
        riskScore -= 25;
        recommendations.push('Ish haqi bazisi bo\'yicha qayta tiklang');
      } else if (salary > MAX_REASONABLE_SALARY) {
        issues.push('Ish haqi noto\'g\'ri ko\'p (shubhali)');
        riskScore -= 20;
      }
    }

    // Check for unsafe keywords in title
    const titleIssues = _detectKeywords(
      job.title?.toLowerCase() || '',
      UNSAFE_KEYWORDS
    );
    issues.push(...titleIssues);
    riskScore -= titleIssues.length * 10;

    // Check for unsafe keywords in description
    const descIssues = _detectKeywords(
      job.description?.toLowerCase() || '',
      UNSAFE_KEYWORDS
    );
    issues.push(...descIssues);
    riskScore -= descIssues.length * 8;

    // Check for red flags
    const flags = _detectRedFlags(
      job.description?.toLowerCase() || '',
      RED_FLAGS
    );
    issues.push(...flags);
    riskScore -= flags.length * 12;

    // Check if requirements are reasonable
    if (job.requirements && job.requirements.length > 0) {
      const reqIssues = _checkRequirements(job.requirements);
      issues.push(...reqIssues);
      riskScore -= reqIssues.length * 8;
    }

    // Check work type validity
    if (job.workType) {
      if (
        job.workType.toLowerCase().includes('rasm') ||
        job.workType.toLowerCase().includes('shaxs')
      ) {
        issues.push('Ish turi shubhali');
        riskScore -= 15;
      }
    }

    // Check category validity
    if (!job.category || job.category.length === 0) {
      issues.push('Ish kategoriyasi ko\'rsatilmagan');
      riskScore -= 10;
    }

    // Ensure score is within valid range
    riskScore = Math.max(0, Math.min(100, riskScore));

    const isSafe = riskScore >= 70;
    let riskLevel: 'safe' | 'warning' | 'dangerous' = 'safe';

    if (riskScore >= 70) {
      riskLevel = 'safe';
      recommendations.push('Bu ish xavfsiz ko\'rinadi');
    } else if (riskScore >= 40) {
      riskLevel = 'warning';
      recommendations.push('Bu ishni olishdan oldin ehtiyot bilan tushunib oling');
    } else {
      riskLevel = 'dangerous';
      recommendations.push('Ushbu ishning xavfli bo\'lishi mumkin. Admin-ga xabar bering');
    }

    return {
      isSafe,
      riskLevel,
      score: riskScore,
      issues: [...new Set(issues)], // Remove duplicates
      recommendations
    };
  },

  /**
   * Generate safety report for display
   */
  generateSafetyReport(assessment: SafetyAssessment): string {
    const report = [];

    if (assessment.riskLevel === 'safe') {
      report.push('✅ Ushbu ish xavfsiz bo\'lib ko\'rinadi');
    } else if (assessment.riskLevel === 'warning') {
      report.push('⚠️ Ehtiyot: Ushbu ishda ayrim muammolar bor');
    } else {
      report.push('🚫 XAVF: Bu ish xavfli bo\'lishi mumkin');
    }

    if (assessment.issues.length > 0) {
      report.push('\nMuammolar:');
      assessment.issues.forEach(issue => {
        report.push(`• ${issue}`);
      });
    }

    if (assessment.recommendations.length > 0) {
      report.push('\nTaklif:');
      assessment.recommendations.forEach(rec => {
        report.push(`• ${rec}`);
      });
    }

    return report.join('\n');
  }
};

/**
 * Detect unsafe keywords in text
 */
function _detectKeywords(
  text: string,
  keywordMap: Record<string, string[]>
): string[] {
  const issues: string[] = [];

  for (const [category, keywords] of Object.entries(keywordMap)) {
    const found = keywords.filter(kw => text.includes(kw));

    if (found.length > 0) {
      switch (category) {
        case 'exploitation':
          issues.push('Ish-xizmatni baliqchilari bo\'lishi xavfli');
          break;
        case 'discrimination':
          issues.push('Ishda diskriminatsiya belgilari');
          break;
        case 'abuse':
          issues.push('Jismoniy va ruhiy ta\'qiqlanish xavfi');
          break;
        case 'underPay':
          issues.push('Barqaror to\'lamaslik xavfi');
          break;
      }
    }
  }

  return issues;
}

/**
 * Detect red flags in job description
 */
function _detectRedFlags(text: string, flags: Record<string, string[]>): string[] {
  const detected: string[] = [];

  for (const [flag, keywords] of Object.entries(flags)) {
    if (keywords.some(kw => text.includes(kw))) {
      switch (flag) {
        case 'noPayment':
          detected.push('To\'lov yo\'q yoki noaniq');
          break;
        case 'noContract':
          detected.push('Shartnoma yoki rasmiy ta\'minot yo\'q');
          break;
        case 'isolation':
          detected.push('Izolatsiya va nomukammal xavf');
          break;
        case 'workPermit':
          detected.push('Hujjat talabi - shubhali');
          break;
        case 'excessive':
          detected.push('Haddan tashqari ish vaqti');
          break;
        case 'hostage':
          detected.push('Gajagajlik uchun hujjat asiri bo\'lish xavfi');
          break;
      }
    }
  }

  return detected;
}

/**
 * Check if requirements are reasonable
 */
function _checkRequirements(requirements: string[]): string[] {
  const issues: string[] = [];

  requirements.forEach(req => {
    const lower = req.toLowerCase();

    // Check for unreasonable requirements
    if (
      lower.includes('pasport') ||
      lower.includes('ID') ||
      lower.includes('hujjat')
    ) {
      issues.push('Shaxsiy hujjat talabi shubhali');
    }

    if (lower.includes('pul') || lower.includes('depozit')) {
      issues.push('Avans yoki depozit talabi qonunsiz');
    }

    if (lower.includes('intiklos') || lower.includes('qasos')) {
      issues.push('Urinish yoki tahdid rasmi');
    }
  });

  return issues;
}
