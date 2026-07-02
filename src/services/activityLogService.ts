import { debugLogger } from '../lib/debugLogger';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, limit, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';

export interface ActivityLog {
  id?: string;
  userId: string;
  userName?: string;
  userRole?: string;
  action: 'login' | 'logout' | 'view_job' | 'apply_job' | 'post_job' | 'send_message' | 'create_contract' | 'update_profile';
  loginTime?: Timestamp;
  logoutTime?: Timestamp;
  sessionDuration?: number; // in seconds
  ipAddress?: string;
  deviceInfo?: {
    userAgent: string;
    platform: string;
    language: string;
    screenResolution: string;
  };
  metadata?: Record<string, any>;
  createdAt?: Timestamp;
}

export interface OnlineUser {
  userId: string;
  userName: string;
  userRole: string;
  loginTime: Timestamp;
  lastActivity: Timestamp;
  ipAddress?: string;
}

class ActivityLogService {
  private sessionStartTime: number | null = null;

  // Get device information
  private getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${window.screen.width}x${window.screen.height}`
    };
  }

  // Get IP address (simplified - in production use a proper service)
  private async getIPAddress(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch {
      return 'unknown';
    }
  }

  // Log user login
  async logLogin(userId: string, userName: string, userRole: string) {
    try {
      this.sessionStartTime = Date.now();
      const ipAddress = await this.getIPAddress();
      
      await addDoc(collection(db, 'activity_logs'), {
        userId,
        userName,
        userRole,
        action: 'login',
        loginTime: serverTimestamp(),
        ipAddress,
        deviceInfo: this.getDeviceInfo(),
        createdAt: serverTimestamp()
      });

      // Update online users
      await addDoc(collection(db, 'online_users'), {
        userId,
        userName,
        userRole,
        loginTime: serverTimestamp(),
        lastActivity: serverTimestamp(),
        ipAddress
      });
    } catch (error) {
      debugLogger.error('Error logging login:', error);
    }
  }

  // Log user logout
  async logLogout(userId: string) {
    try {
      const sessionDuration = this.sessionStartTime 
        ? Math.floor((Date.now() - this.sessionStartTime) / 1000)
        : 0;

      await addDoc(collection(db, 'activity_logs'), {
        userId,
        action: 'logout',
        logoutTime: serverTimestamp(),
        sessionDuration,
        createdAt: serverTimestamp()
      });

      this.sessionStartTime = null;
    } catch (error) {
      debugLogger.error('Error logging logout:', error);
    }
  }

  // Log generic action
  async logAction(
    userId: string,
    action: ActivityLog['action'],
    metadata?: Record<string, any>
  ) {
    try {
      await addDoc(collection(db, 'activity_logs'), {
        userId,
        action,
        metadata,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      debugLogger.error('Error logging action:', error);
    }
  }

  // Get user activity logs
  getUserLogs(userId: string, callback: (logs: ActivityLog[]) => void) {
    const q = query(
      collection(db, 'activity_logs'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
      callback(logs);
    });
  }

  // Get all activity logs (admin only)
  getAllLogs(callback: (logs: ActivityLog[]) => void) {
    const q = query(
      collection(db, 'activity_logs'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    return onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ActivityLog));
      callback(logs);
    });
  }

  // Get online users count
  getOnlineUsers(callback: (users: OnlineUser[]) => void) {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    const q = query(
      collection(db, 'online_users'),
      where('lastActivity', '>', Timestamp.fromDate(fiveMinutesAgo))
    );

    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as OnlineUser);
      callback(users);
    });
  }
}

export const activityLogService = new ActivityLogService();
