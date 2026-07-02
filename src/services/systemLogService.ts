import { debugLogger } from '../lib/debugLogger';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, onSnapshot, orderBy, Timestamp, getDoc, setDoc } from 'firebase/firestore';

export interface SystemLog {
  id?: string;
  timestamp: Timestamp;
  action: string;
  userId?: string;
  userEmail?: string;
  details?: Record<string, any>;
  type: 'info' | 'warning' | 'error';
}

export interface GlobalSettings {
  maxJobPostsPerWeek: number;
  maxServicePostsPerWeek: number;
  maxApplicationsPerDay: number;
  enableNotifications: boolean;
  enableModeration: boolean;
  maintenanceMode: boolean;
  updatedAt?: Timestamp;
  updatedBy?: string;
}

class SystemLogService {
  /**
   * Log system action with timestamp and type
   */
  async logAction(
    action: string,
    userId: string | undefined,
    userEmail: string | undefined,
    details: Record<string, any>,
    type: 'info' | 'warning' | 'error' = 'info'
  ): Promise<string | null> {
    try {
      const docRef = await addDoc(collection(db, 'system_logs'), {
        action,
        userId,
        userEmail,
        details,
        type,
        timestamp: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      debugLogger.error('Error logging system action:', error);
      return null;
    }
  }

  /**
   * Subscribe to real-time system logs (for dashboard)
   */
  subscribeLogs(
    limit: number,
    callback: (logs: SystemLog[]) => void,
    onError?: (error: Error) => void
  ) {
    try {
      const q = query(
        collection(db, 'system_logs'),
        orderBy('timestamp', 'desc')
      );

      return onSnapshot(q, (snapshot) => {
        const logs: SystemLog[] = snapshot.docs
          .slice(0, limit)
          .map(doc => ({
            id: doc.id,
            ...(doc.data() as Omit<SystemLog, 'id'>)
          }));
        callback(logs);
      }, (error) => {
        debugLogger.error('Error subscribing to logs:', error);
        if (onError) onError(error as Error);
      });
    } catch (error) {
      debugLogger.error('Error setting up logs subscription:', error);
      if (onError) onError(error as Error);
      return () => {}; // Return empty unsubscribe
    }
  }

  /**
   * Get global settings from Firestore
   */
  async getGlobalSettings(): Promise<GlobalSettings> {
    try {
      const docSnap = await getDoc(doc(db, 'settings', 'global_config'));
      if (docSnap.exists()) {
        return docSnap.data() as GlobalSettings;
      }
      // Return defaults if not found
      return {
        maxJobPostsPerWeek: 5,
        maxServicePostsPerWeek: 3,
        maxApplicationsPerDay: 10,
        enableNotifications: true,
        enableModeration: true,
        maintenanceMode: false
      };
    } catch (error) {
      debugLogger.error('Error fetching global settings:', error);
      handleFirestoreError(error, OperationType.GET, 'settings/global_config');
      // Return defaults on error
      return {
        maxJobPostsPerWeek: 5,
        maxServicePostsPerWeek: 3,
        maxApplicationsPerDay: 10,
        enableNotifications: true,
        enableModeration: true,
        maintenanceMode: false
      };
    }
  }

  /**
   * Update global settings (Super Admin only)
   */
  async updateGlobalSettings(settings: Partial<GlobalSettings>, adminId: string): Promise<boolean> {
    try {
      await setDoc(
        doc(db, 'settings', 'global_config'),
        {
          ...settings,
          updatedAt: serverTimestamp(),
          updatedBy: adminId
        },
        { merge: true }
      );

      // Log the settings change
      await this.logAction(
        'UPDATE_GLOBAL_SETTINGS',
        adminId,
        undefined,
        settings,
        'info'
      );

      return true;
    } catch (error) {
      debugLogger.error('Error updating global settings:', error);
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global_config');
      return false;
    }
  }

  /**
   * Subscribe to global settings (for real-time updates)
   */
  subscribeGlobalSettings(
    callback: (settings: GlobalSettings) => void,
    onError?: (error: Error) => void
  ) {
    try {
      return onSnapshot(doc(db, 'settings', 'global_config'), (snapshot) => {
        if (snapshot.exists()) {
          callback(snapshot.data() as GlobalSettings);
        } else {
          // If document doesn't exist, use defaults
          callback({
            maxJobPostsPerWeek: 5,
            maxServicePostsPerWeek: 3,
            maxApplicationsPerDay: 10,
            enableNotifications: true,
            enableModeration: true,
            maintenanceMode: false
          });
        }
      }, (error) => {
        debugLogger.error('Error subscribing to settings:', error);
        if (onError) onError(error as Error);
      });
    } catch (error) {
      debugLogger.error('Error setting up settings subscription:', error);
      if (onError) onError(error as Error);
      return () => {};
    }
  }
}

export default new SystemLogService();
