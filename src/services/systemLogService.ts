import { debugLogger } from '../lib/debugLogger';
import { api } from '../lib/api';

export interface SystemLog {
  id?: string;
  timestamp?: string;
  createdAt?: string;
  action: string;
  userId?: string;
  userEmail?: string;
  details?: Record<string, unknown>;
  type: 'info' | 'warning' | 'error';
}

export interface GlobalSettings {
  maxJobPostsPerWeek: number;
  maxServicePostsPerWeek: number;
  maxApplicationsPerDay: number;
  enableNotifications: boolean;
  enableModeration: boolean;
  maintenanceMode: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_SETTINGS: GlobalSettings = {
  maxJobPostsPerWeek: 5,
  maxServicePostsPerWeek: 3,
  maxApplicationsPerDay: 10,
  enableNotifications: true,
  enableModeration: true,
  maintenanceMode: false,
};

class SystemLogService {
  async logAction(
    action: string,
    userId: string | undefined,
    userEmail: string | undefined,
    details: Record<string, unknown>,
    type: 'info' | 'warning' | 'error' = 'info'
  ): Promise<string | null> {
    try {
      await api.systemLogs.create({ action, userId, userEmail, details, type });
      return 'ok';
    } catch (error) {
      debugLogger.error('Error logging system action:', error);
      return null;
    }
  }

  subscribeLogs(limit: number, callback: (logs: SystemLog[]) => void, onError?: (error: Error) => void) {
    const load = async () => {
      try {
        const logs = (await api.systemLogs.list()) as SystemLog[];
        callback(logs.slice(0, limit));
      } catch (error) {
        if (onError) onError(error as Error);
      }
    };
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }

  async getGlobalSettings(): Promise<GlobalSettings> {
    try {
      const data = (await api.settings.getGlobal()) as unknown as GlobalSettings;
      return { ...DEFAULT_SETTINGS, ...data };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  async updateGlobalSettings(settings: Partial<GlobalSettings>, updatedBy?: string): Promise<boolean> {
    try {
      await api.settings.updateGlobal({ ...settings, updatedBy });
      return true;
    } catch (error) {
      debugLogger.error('Error updating global settings:', error);
      return false;
    }
  }

  subscribeGlobalSettings(callback: (settings: GlobalSettings) => void, onError?: (error: Error) => void) {
    const load = async () => {
      try {
        callback(await this.getGlobalSettings());
      } catch (error) {
        if (onError) onError(error as Error);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }
}

export default new SystemLogService();
