import { debugLogger } from '../../lib/debugLogger';

/**
 * Salary Estimation Service - AI-ready salary predictor
 * Provides fair market salary recommendations based on job characteristics
 */

export interface SalaryEstimate {
  minSalary: number;
  maxSalary: number;
  avgSalary: number;
  confidence: number; // 0-100
  factors: string[];
  currency: string;
}

interface SalaryFactors {
  category: string;
  location: string;
  experienceLevel: 'beginner' | 'intermediate' | 'expert' | string;
  salaryType: 'hourly' | 'daily' | 'monthly' | 'fixed';
  jobTitle?: string;
}

// Base salary matrix by category and experience level (in daily rate)
const SALARY_MATRIX: Record<string, Record<string, { min: number; max: number }>> = {
  cooking: {
    beginner: { min: 30000, max: 50000 },
    intermediate: { min: 50000, max: 80000 },
    expert: { min: 80000, max: 150000 }
  },
  cleaning: {
    beginner: { min: 25000, max: 40000 },
    intermediate: { min: 40000, max: 60000 },
    expert: { min: 60000, max: 100000 }
  },
  childcare: {
    beginner: { min: 40000, max: 60000 },
    intermediate: { min: 60000, max: 100000 },
    expert: { min: 100000, max: 180000 }
  },
  elderly_care: {
    beginner: { min: 50000, max: 70000 },
    intermediate: { min: 70000, max: 120000 },
    expert: { min: 120000, max: 200000 }
  },
  tutoring: {
    beginner: { min: 40000, max: 70000 },
    intermediate: { min: 70000, max: 120000 },
    expert: { min: 120000, max: 250000 }
  },
  handicraft: {
    beginner: { min: 35000, max: 55000 },
    intermediate: { min: 55000, max: 90000 },
    expert: { min: 90000, max: 150000 }
  },
  beauty: {
    beginner: { min: 35000, max: 60000 },
    intermediate: { min: 60000, max: 100000 },
    expert: { min: 100000, max: 180000 }
  },
  default: {
    beginner: { min: 30000, max: 50000 },
    intermediate: { min: 50000, max: 80000 },
    expert: { min: 80000, max: 150000 }
  }
};

// Location multipliers (based on regional cost of living)
const LOCATION_MULTIPLIERS: Record<string, number> = {
  'Toshkent shahar': 1.3,
  'Tashkent City': 1.3,
  'Tashkent': 1.3,
  'Andijon viloyati': 1.0,
  'Buxoro viloyati': 1.1,
  'Fargona viloyati': 1.0,
  'Jizzax viloyati': 0.95,
  'Xorazm viloyati': 0.95,
  'Navo\'i viloyati': 1.05,
  'Namangan viloyati': 0.95,
  'Samarqand viloyati': 1.1,
  'Surkhandarya viloyati': 0.95,
  'Sirdarya viloyati': 1.0,
  default: 1.0
};

export const salaryEstimationService = {
  /**
   * Estimate salary for a job posting
   * Future: Integrate with ML model for more accurate predictions
   */
  estimateSalary(factors: SalaryFactors): SalaryEstimate {
    try {
      const baseRange = _getBaseRange(factors.category, factors.experienceLevel);
      const locationMultiplier = _getLocationMultiplier(factors.location);

      let min = baseRange.min * locationMultiplier;
      let max = baseRange.max * locationMultiplier;

      const appliedFactors: string[] = [];

      // Apply salary type adjustments
      const typeAdjustment = _getSalaryTypeAdjustment(factors.salaryType);
      min *= typeAdjustment;
      max *= typeAdjustment;

      if (factors.salaryType === 'hourly') {
        appliedFactors.push('Soatbay hisoblash bazasi');
      } else if (factors.salaryType === 'monthly') {
        appliedFactors.push('Oylik hisoblash bazasi');
      }

      // Regional adjustment
      if (locationMultiplier !== 1.0) {
        appliedFactors.push(`Mintaqaviy moslashtirish: ${(locationMultiplier * 100).toFixed(0)}%`);
      }

      // Experience adjustment
      if (factors.experienceLevel !== 'intermediate') {
        appliedFactors.push(`${factors.experienceLevel} daraja`);
      }

      const avgSalary = Math.round((min + max) / 2);
      const confidence = _calculateConfidence(factors);

      return {
        minSalary: Math.round(min),
        maxSalary: Math.round(max),
        avgSalary,
        confidence,
        factors: appliedFactors,
        currency: 'UZS'
      };
    } catch (error) {
      debugLogger.error('Error estimating salary:', error);
      return {
        minSalary: 0,
        maxSalary: 0,
        avgSalary: 0,
        confidence: 0,
        factors: ['Xatolik yuz berdi'],
        currency: 'UZS'
      };
    }
  },

  /**
   * Format salary for display
   */
  formatSalary(amount: number, type: string = 'daily'): string {
    const formatter = new Intl.NumberFormat('uz-UZ', {
      style: 'currency',
      currency: 'UZS',
      maximumFractionDigits: 0
    });

    const typeLabel = {
      hourly: '/soat',
      daily: '/kun',
      monthly: '/oy',
      fixed: ''
    }[type.toLowerCase()] || '';

    return formatter.format(amount) + typeLabel;
  },

  /**
   * Get salary range as string
   */
  formatSalaryRange(estimate: SalaryEstimate): string {
    return `${salaryEstimationService.formatSalary(estimate.minSalary)} - ${salaryEstimationService.formatSalary(estimate.maxSalary)}`;
  }
};

/**
 * Get base salary range for a category and experience level
 */
function _getBaseRange(
  category: string,
  experienceLevel: string
): { min: number; max: number } {
  const normalized = category.toLowerCase();
  const level = experienceLevel.toLowerCase();

  const categoryData = SALARY_MATRIX[normalized] || SALARY_MATRIX.default;
  return categoryData[level] || categoryData.intermediate;
}

/**
 * Get location multiplier
 */
function _getLocationMultiplier(location: string): number {
  return LOCATION_MULTIPLIERS[location] || LOCATION_MULTIPLIERS.default;
}

/**
 * Get salary type adjustment multiplier
 * Converts between hourly, daily, monthly, and fixed rates
 */
function _getSalaryTypeAdjustment(salaryType: string): number {
  switch (salaryType.toLowerCase()) {
    case 'hourly':
      // Convert daily to hourly (8-hour workday)
      return 1 / 8;
    case 'monthly':
      // Convert daily to monthly (22 working days)
      return 22;
    case 'fixed':
    case 'daily':
    default:
      return 1; // Base is daily rate
  }
}

/**
 * Calculate confidence level of salary estimate
 */
function _calculateConfidence(factors: SalaryFactors): number {
  let confidence = 60; // Base confidence

  // Check if category is in matrix
  if (factors.category.toLowerCase() in SALARY_MATRIX) {
    confidence += 20;
  }

  // Check if location is known
  if (factors.location in LOCATION_MULTIPLIERS) {
    confidence += 10;
  }

  // Check if experience level is standard
  if (['beginner', 'intermediate', 'expert'].includes(factors.experienceLevel.toLowerCase())) {
    confidence += 10;
  }

  return Math.min(100, confidence);
}
