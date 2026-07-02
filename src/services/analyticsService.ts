import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';

// ============================================
// ANALYTICS TYPES
// ============================================

export interface PlatformStats {
  totalUsers: number;
  totalWorkers: number;
  totalEmployers: number;
  totalAdmins: number;
  activeUsers: number; // Active in last 30 days
  newUsersToday: number;
  newUsersThisWeek: number;
  newUsersThisMonth: number;
}

export interface JobStats {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  jobsByCategory: Record<string, number>;
  jobsByRegion: Record<string, number>;
  averageJobPrice: number;
}

export interface ApplicationStats {
  totalApplications: number;
  pendingApplications: number;
  acceptedApplications: number;
  rejectedApplications: number;
  averageResponseTime: number; // in hours
  conversionRate: number; // accepted / total
}

export interface ContractStats {
  totalContracts: number;
  activeContracts: number;
  completedContracts: number;
  totalRevenue: number;
  averageContractValue: number;
  completionRate: number;
}

export interface EngagementMetrics {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
  averageJobsViewedPerUser: number;
  averageApplicationsPerUser: number;
}

export interface ConversionFunnel {
  visitors: number;
  signups: number;
  profileCompleted: number;
  firstApplication: number;
  firstContract: number;
  signupRate: number; // signups / visitors
  profileCompletionRate: number; // profileCompleted / signups
  applicationRate: number; // firstApplication / profileCompleted
  contractRate: number; // firstContract / firstApplication
}

// ============================================
// ANALYTICS SERVICE
// ============================================

export const analyticsService = {
  /**
   * Get comprehensive platform statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    try {
      const usersSnap = await getDocs(collection(db, 'profiles'));
      const users = usersSnap.docs.map(d => d.data());

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      return {
        totalUsers: users.length,
        totalWorkers: users.filter(u => u.role === 'worker').length,
        totalEmployers: users.filter(u => u.role === 'employer').length,
        totalAdmins: users.filter(u => u.role === 'admin' || u.role === 'super_admin').length,
        activeUsers: users.filter(u => {
          const lastActive = u.lastActive?.toDate?.() || new Date(0);
          return lastActive > monthAgo;
        }).length,
        newUsersToday: users.filter(u => {
          const created = u.createdAt?.toDate?.() || new Date(0);
          return created >= today;
        }).length,
        newUsersThisWeek: users.filter(u => {
          const created = u.createdAt?.toDate?.() || new Date(0);
          return created >= weekAgo;
        }).length,
        newUsersThisMonth: users.filter(u => {
          const created = u.createdAt?.toDate?.() || new Date(0);
          return created >= monthAgo;
        }).length
      };
    } catch (error) {
      debugLogger.error('Error fetching platform stats:', error);
      handleFirestoreError(error, OperationType.LIST, 'profiles');
      throw error;
    }
  },

  /**
   * Get job statistics
   */
  async getJobStats(): Promise<JobStats> {
    try {
      const jobsSnap = await getDocs(collection(db, 'jobs'));
      const jobs = jobsSnap.docs.map(d => d.data());

      // Count by category
      const jobsByCategory: Record<string, number> = {};
      jobs.forEach(job => {
        const category = job.category || 'other';
        jobsByCategory[category] = (jobsByCategory[category] || 0) + 1;
      });

      // Count by region
      const jobsByRegion: Record<string, number> = {};
      jobs.forEach(job => {
        const region = job.region || 'unknown';
        jobsByRegion[region] = (jobsByRegion[region] || 0) + 1;
      });

      // Calculate average price
      const totalPrice = jobs.reduce((sum, job) => sum + (job.price || 0), 0);
      const averageJobPrice = jobs.length > 0 ? totalPrice / jobs.length : 0;

      return {
        totalJobs: jobs.length,
        activeJobs: jobs.filter(j => j.status === 'open').length,
        completedJobs: jobs.filter(j => j.status === 'completed').length,
        jobsByCategory,
        jobsByRegion,
        averageJobPrice
      };
    } catch (error) {
      debugLogger.error('Error fetching job stats:', error);
      handleFirestoreError(error, OperationType.LIST, 'jobs');
      throw error;
    }
  },

  /**
   * Get application statistics
   */
  async getApplicationStats(): Promise<ApplicationStats> {
    try {
      const appsSnap = await getDocs(collection(db, 'applications'));
      const applications = appsSnap.docs.map(d => d.data());

      const pending = applications.filter(a => a.status === 'pending');
      const accepted = applications.filter(a => a.status === 'accepted');
      const rejected = applications.filter(a => a.status === 'rejected');

      // Calculate average response time (for accepted/rejected)
      const respondedApps = [...accepted, ...rejected];
      let totalResponseTime = 0;
      respondedApps.forEach(app => {
        if (app.createdAt && app.updatedAt) {
          const created = app.createdAt.toDate?.() || new Date(app.createdAt);
          const updated = app.updatedAt.toDate?.() || new Date(app.updatedAt);
          const diff = updated.getTime() - created.getTime();
          totalResponseTime += diff / (1000 * 60 * 60); // Convert to hours
        }
      });
      const averageResponseTime = respondedApps.length > 0 
        ? totalResponseTime / respondedApps.length 
        : 0;

      // Calculate conversion rate
      const conversionRate = applications.length > 0
        ? (accepted.length / applications.length) * 100
        : 0;

      return {
        totalApplications: applications.length,
        pendingApplications: pending.length,
        acceptedApplications: accepted.length,
        rejectedApplications: rejected.length,
        averageResponseTime,
        conversionRate
      };
    } catch (error) {
      debugLogger.error('Error fetching application stats:', error);
      handleFirestoreError(error, OperationType.LIST, 'applications');
      throw error;
    }
  },

  /**
   * Get contract statistics
   */
  async getContractStats(): Promise<ContractStats> {
    try {
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const contracts = contractsSnap.docs.map(d => d.data());

      const active = contracts.filter(c => c.status === 'active');
      const completed = contracts.filter(c => c.status === 'completed');

      // Calculate total revenue
      const totalRevenue = completed.reduce((sum, c) => sum + (c.amount || 0), 0);

      // Calculate average contract value
      const averageContractValue = contracts.length > 0
        ? contracts.reduce((sum, c) => sum + (c.amount || 0), 0) / contracts.length
        : 0;

      // Calculate completion rate
      const completionRate = contracts.length > 0
        ? (completed.length / contracts.length) * 100
        : 0;

      return {
        totalContracts: contracts.length,
        activeContracts: active.length,
        completedContracts: completed.length,
        totalRevenue,
        averageContractValue,
        completionRate
      };
    } catch (error) {
      debugLogger.error('Error fetching contract stats:', error);
      handleFirestoreError(error, OperationType.LIST, 'contracts');
      throw error;
    }
  },

  /**
   * Get engagement metrics
   */
  async getEngagementMetrics(): Promise<EngagementMetrics> {
    try {
      const usersSnap = await getDocs(collection(db, 'profiles'));
      const users = usersSnap.docs.map(d => d.data());

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const dailyActiveUsers = users.filter(u => {
        const lastActive = u.lastActive?.toDate?.() || new Date(0);
        return lastActive > dayAgo;
      }).length;

      const weeklyActiveUsers = users.filter(u => {
        const lastActive = u.lastActive?.toDate?.() || new Date(0);
        return lastActive > weekAgo;
      }).length;

      const monthlyActiveUsers = users.filter(u => {
        const lastActive = u.lastActive?.toDate?.() || new Date(0);
        return lastActive > monthAgo;
      }).length;

      // These would come from actual tracking in production
      return {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        averageSessionDuration: 0, // Implement with actual tracking
        averageJobsViewedPerUser: 0, // Implement with actual tracking
        averageApplicationsPerUser: 0 // Implement with actual tracking
      };
    } catch (error) {
      debugLogger.error('Error fetching engagement metrics:', error);
      throw error;
    }
  },

  /**
   * Get conversion funnel data
   */
  async getConversionFunnel(): Promise<ConversionFunnel> {
    try {
      const usersSnap = await getDocs(collection(db, 'profiles'));
      const users = usersSnap.docs.map(d => d.data());

      // Count users with completed profiles
      const profileCompleted = users.filter(u => 
        u.fullName && u.region && u.district && (u.bio || u.skills?.length > 0)
      ).length;

      // Count users who have applied to at least one job
      const appsSnap = await getDocs(collection(db, 'applications'));
      const uniqueApplicants = new Set(appsSnap.docs.map(d => d.data().workerId));
      const firstApplication = uniqueApplicants.size;

      // Count users who have at least one contract
      const contractsSnap = await getDocs(collection(db, 'contracts'));
      const uniqueContractUsers = new Set(contractsSnap.docs.map(d => d.data().workerId));
      const firstContract = uniqueContractUsers.size;

      // For visitors, we'd need actual tracking
      // Using total users as proxy for now
      const visitors = users.length * 2; // Assume 2x visitors vs signups
      const signups = users.length;

      return {
        visitors,
        signups,
        profileCompleted,
        firstApplication,
        firstContract,
        signupRate: visitors > 0 ? (signups / visitors) * 100 : 0,
        profileCompletionRate: signups > 0 ? (profileCompleted / signups) * 100 : 0,
        applicationRate: profileCompleted > 0 ? (firstApplication / profileCompleted) * 100 : 0,
        contractRate: firstApplication > 0 ? (firstContract / firstApplication) * 100 : 0
      };
    } catch (error) {
      debugLogger.error('Error fetching conversion funnel:', error);
      throw error;
    }
  },

  /**
   * Track event (for future analytics)
   */
  async trackEvent(
    userId: string,
    eventName: string,
    eventData?: Record<string, any>
  ): Promise<void> {
    try {
      // In production, send to analytics service (Google Analytics, Mixpanel, etc.)
      // For now, just log to console
      debugLogger.log('Analytics Event:', {
        userId,
        eventName,
        eventData,
        timestamp: new Date()
      });

      // Optionally store in Firestore for custom analytics
      // await addDoc(collection(db, 'analytics_events'), {
      //   userId,
      //   eventName,
      //   eventData,
      //   timestamp: serverTimestamp()
      // });
    } catch (error) {
      debugLogger.error('Error tracking event:', error);
    }
  },

  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData() {
    try {
      const [
        platformStats,
        jobStats,
        applicationStats,
        contractStats,
        engagementMetrics,
        conversionFunnel
      ] = await Promise.all([
        this.getPlatformStats(),
        this.getJobStats(),
        this.getApplicationStats(),
        this.getContractStats(),
        this.getEngagementMetrics(),
        this.getConversionFunnel()
      ]);

      return {
        platformStats,
        jobStats,
        applicationStats,
        contractStats,
        engagementMetrics,
        conversionFunnel,
        lastUpdated: new Date()
      };
    } catch (error) {
      debugLogger.error('Error fetching dashboard data:', error);
      throw error;
    }
  }
};
