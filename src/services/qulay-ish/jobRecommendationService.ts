import { debugLogger } from '../../lib/debugLogger';
import { Job, Profile } from '../../types';

/**
 * Job Recommendation Service - AI-ready recommendation engine
 * Analyzes worker profiles and job posts to generate personalized recommendations
 */

export interface RecommendationScore {
  jobId: string;
  score: number; // 0-100
  matchReasons: string[];
  skillMatch: number;
  locationMatch: number;
  experienceMatch: number;
}

interface MatchCriteria {
  skills: string[];
  experience: string;
  location: {
    region: string;
    district?: string;
  };
  categories?: string[];
  salaryExpectation?: number;
}

class JobRecommendationServiceClass {
  /**
   * Calculate match score between worker profile and job
   * Future: Replace with trained ML model for better predictions
   */
  calculateMatchScore(profile: Profile, job: Job): RecommendationScore {
    const matchReasons: string[] = [];
    let totalScore = 0;
    let scoreCount = 0;

    // Skill matching (25%)
    const skillMatch = this._calculateSkillMatch(profile.skills || [], job.requirements || []);
    if (skillMatch > 0) {
      matchReasons.push(`Ko'nikalarga mos: ${skillMatch}% mos`);
    }
    totalScore += skillMatch * 0.25;
    scoreCount++;

    // Location matching (25%)
    const locationMatch = this._calculateLocationMatch(
      {
        region: profile.region,
        district: profile.district
      },
      {
        region: job.region,
        district: job.district
      }
    );
    if (locationMatch > 0) {
      matchReasons.push(`Joyga yaqin: ${locationMatch}% mos`);
    }
    totalScore += locationMatch * 0.25;
    scoreCount++;

    // Experience matching (25%)
    const experienceMatch = this._calculateExperienceMatch(
      profile.experienceLevel || 'beginner',
      job.workType || 'general'
    );
    if (experienceMatch > 0) {
      matchReasons.push(`Tajribaga mos: ${experienceMatch}% mos`);
    }
    totalScore += experienceMatch * 0.25;
    scoreCount++;

    // Category preference matching (25%)
    const categoryMatch = this._calculateCategoryMatch(
      profile.education || [],
      job.category || ''
    );
    if (categoryMatch > 0) {
      matchReasons.push(`Kategoriyaga mos: ${categoryMatch}% mos`);
    }
    totalScore += categoryMatch * 0.25;
    scoreCount++;

    const finalScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;

    return {
      jobId: job.id,
      score: Math.min(100, Math.max(0, finalScore)),
      matchReasons,
      skillMatch,
      locationMatch,
      experienceMatch
    };
  }

  /**
   * Calculate skill match percentage
   */
  private _calculateSkillMatch(workerSkills: string[], jobRequirements: string[]): number {
    if (jobRequirements.length === 0) return 50; // Neutral score if no requirements

    const normalizedWorkerSkills = workerSkills.map(s => s.toLowerCase().trim());
    const normalizedRequirements = jobRequirements.map(r => r.toLowerCase().trim());

    const matches = normalizedRequirements.filter(req =>
      normalizedWorkerSkills.some(ws =>
        ws.includes(req) || req.includes(ws) || this._fuzzyMatch(ws, req)
      )
    ).length;

    return Math.round((matches / normalizedRequirements.length) * 100);
  }

  /**
   * Calculate location match percentage
   */
  private _calculateLocationMatch(
    workerLocation: { region: string; district?: string },
    jobLocation: { region: string; district?: string }
  ): number {
    // Same district (100%)
    if (
      workerLocation.region === jobLocation.region &&
      workerLocation.district === jobLocation.district
    ) {
      return 100;
    }

    // Same region (60%)
    if (workerLocation.region === jobLocation.region) {
      return 60;
    }

    // Different regions (0%)
    return 0;
  }

  /**
   * Calculate experience level match
   */
  private _calculateExperienceMatch(workerLevel: string, jobType: string): number {
    const level = workerLevel.toLowerCase();
    const type = jobType.toLowerCase();

    // Exact matches get full score
    if (level.includes('expert') || level.includes('senior')) return 100;
    if (level.includes('intermediate') && (type.includes('intermediate') || type.includes('mid'))) return 90;
    if (level.includes('beginner') && (type.includes('entry') || type.includes('junior'))) return 85;

    // Close matches
    if (level.includes('intermediate') || level.includes('mid')) return 70;
    if (level.includes('beginner')) return 60;

    return 50;
  }

  /**
   * Calculate category match based on education and experience
   */
  private _calculateCategoryMatch(education: any[], jobCategory: string): number {
    if (!education || education.length === 0 || !jobCategory) return 50;

    const normalized = jobCategory.toLowerCase();
    const educationText = education
      .map(e => `${e.degree || ''} ${e.field || ''}`.toLowerCase())
      .join(' ');

    if (educationText.includes(normalized)) return 100;
    if (normalized.length > 3 && educationText.includes(normalized.substring(0, 3))) return 70;

    return 50;
  }

  /**
   * Simple fuzzy matching for skill names
   */
  private _fuzzyMatch(str1: string, str2: string): boolean {
    if (str1.length < 2 || str2.length < 2) return str1 === str2;

    const s1 = str1.split('');
    const s2 = str2.split('');
    let matches = 0;

    for (let i = 0; i < Math.min(s1.length, s2.length); i++) {
      if (s1[i] === s2[i]) matches++;
    }

    return matches / Math.max(s1.length, s2.length) > 0.6;
  }

  /**
   * Get top recommended jobs for a worker
   * Future: Replace with vector similarity search and trained model
   */
  async getRecommendedJobs(
    workerProfile: Profile,
    allJobs: Job[],
    topN: number = 10
  ): Promise<RecommendationScore[]> {
    try {
      const scores = allJobs.map(job => this.calculateMatchScore(workerProfile, job));

      return scores
        .filter(s => s.score >= 40) // Only jobs with decent match
        .sort((a, b) => b.score - a.score)
        .slice(0, topN);
    } catch (error) {
      debugLogger.error('Error getting recommended jobs:', error);
      return [];
    }
  }
}

export const jobRecommendationService = new JobRecommendationServiceClass();
