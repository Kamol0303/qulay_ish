/**
 * demoStore — shared localStorage persistence for demo users, jobs, and contracts.
 *
 * Keys:
 *   qulayish_demo_users      — array of Profile-like objects
 *   qulayish_demo_jobs       — array of Job-like objects
 *   qulayish_demo_contracts  — array of Contract-like objects
 */

const USERS_KEY = 'qulayish_demo_users';
const JOBS_KEY = 'qulayish_demo_jobs';
const CONTRACTS_KEY = 'qulayish_demo_contracts';

function readJSON<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeJSON<T>(key: string, data: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // storage full — ignore
  }
}

export const demoStore = {
  // ── Users ──────────────────────────────────────────────────────────────────

  getUsers(): any[] {
    return readJSON(USERS_KEY);
  },

  upsertUser(user: any): void {
    const users = readJSON<any>(USERS_KEY);
    const idx = users.findIndex((u) => u.uid === user.uid);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user, updatedAt: new Date().toISOString() };
    } else {
      users.push({ ...user, createdAt: user.createdAt || new Date().toISOString() });
    }
    writeJSON(USERS_KEY, users);
  },

  updateUser(uid: string, patch: any): void {
    const users = readJSON<any>(USERS_KEY);
    const idx = users.findIndex((u) => u.uid === uid);
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...patch, updatedAt: new Date().toISOString() };
    } else {
      // User not in localStorage yet — add them so the patch is persisted
      users.push({ uid, ...patch, updatedAt: new Date().toISOString() });
    }
    writeJSON(USERS_KEY, users);
  },

  removeUser(uid: string): void {
    const users = readJSON<any>(USERS_KEY).filter((u) => u.uid !== uid);
    writeJSON(USERS_KEY, users);
  },

  // ── Jobs ───────────────────────────────────────────────────────────────────

  getJobs(): any[] {
    return readJSON(JOBS_KEY);
  },

  upsertJob(job: any): void {
    const jobs = readJSON<any>(JOBS_KEY);
    const idx = jobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...job, updatedAt: new Date().toISOString() };
    } else {
      jobs.push({ ...job, createdAt: job.createdAt || new Date().toISOString() });
    }
    writeJSON(JOBS_KEY, jobs);
  },

  updateJob(id: string, patch: any): void {
    const jobs = readJSON<any>(JOBS_KEY);
    const idx = jobs.findIndex((j) => j.id === id);
    if (idx >= 0) {
      jobs[idx] = { ...jobs[idx], ...patch, updatedAt: new Date().toISOString() };
      writeJSON(JOBS_KEY, jobs);
    }
  },

  removeJob(id: string): void {
    const jobs = readJSON<any>(JOBS_KEY).filter((j) => j.id !== id);
    writeJSON(JOBS_KEY, jobs);
  },

  // ── Contracts ──────────────────────────────────────────────────────────────────────────────

  getContracts(): any[] {
    return readJSON(CONTRACTS_KEY);
  },

  upsertContract(contract: any): void {
    const contracts = readJSON<any>(CONTRACTS_KEY);
    const idx = contracts.findIndex((c) => c.id === contract.id);
    if (idx >= 0) {
      contracts[idx] = { ...contracts[idx], ...contract, updatedAt: new Date().toISOString() };
    } else {
      contracts.push({ ...contract, createdAt: contract.createdAt || new Date().toISOString() });
    }
    writeJSON(CONTRACTS_KEY, contracts);
  },

  updateContract(id: string, patch: any): void {
    const contracts = readJSON<any>(CONTRACTS_KEY);
    const idx = contracts.findIndex((c) => c.id === id);
    if (idx >= 0) {
      contracts[idx] = { ...contracts[idx], ...patch, updatedAt: new Date().toISOString() };
    } else {
      contracts.push({ id, ...patch, updatedAt: new Date().toISOString() });
    }
    writeJSON(CONTRACTS_KEY, contracts);
  },

  /**
   * Merge API contracts with localStorage demo contracts.
   * localStorage wins for audit/approval status fields when newer.
   */
  mergeContracts(remoteContracts: any[]): any[] {
    const local = readJSON<any>(CONTRACTS_KEY);
    const localMap = new Map<string, any>();
    for (const c of local) localMap.set(c.id, c);

    const result = new Map<string, any>();
    const AUDIT_FIELDS = ['adminApproved', 'adminApprovalStatus', 'adminApprovedBy',
                          'adminApprovedAt', 'rejectedReason', 'rejectedAt',
                          'status', 'updatedAt'];

    for (const fc of remoteContracts) {
      const lc = localMap.get(fc.id);
      if (!lc) {
        result.set(fc.id, fc);
      } else {
        const fsUpdated = fc.updatedAt
          ? (typeof fc.updatedAt.toDate === 'function' ? fc.updatedAt.toDate().getTime() : new Date(fc.updatedAt).getTime())
          : 0;
        const lsUpdated = lc.updatedAt ? new Date(lc.updatedAt).getTime() : 0;
        if (lsUpdated >= fsUpdated) {
          const merged = { ...fc };
          for (const f of AUDIT_FIELDS) { if (lc[f] !== undefined) merged[f] = lc[f]; }
          result.set(fc.id, merged);
        } else {
          result.set(fc.id, fc);
          localMap.set(fc.id, { ...lc, ...fc });
        }
      }
    }
    for (const lc of local) { if (!result.has(lc.id)) result.set(lc.id, lc); }
    writeJSON(CONTRACTS_KEY, Array.from(localMap.values()));
    return Array.from(result.values()).sort((a, b) => {
      const ta = a.createdAt?.seconds ?? (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tb = b.createdAt?.seconds ?? (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tb - ta;
    });
  },

  // ── Merge helpers ──────────────────────────────────────────────────────────

  /**
   * Merge API results with localStorage demo data.
   *
   * Priority rules:
   * - If a user exists ONLY on the server → use server record.
   * - If a user exists ONLY in localStorage → use localStorage record.
   * - If a user exists in BOTH:
   *   - Use server for identity fields (fullName, email, phoneNumber, role, region).
   *   - Use localStorage for status fields (isVerified, isBlocked, status,
   *     verificationStatus, blockedAt, unblockedAt, updatedAt) ONLY when the
   *     localStorage record has a newer updatedAt than the server record.
   *   This ensures Super Admin actions (saved to localStorage) are never
   *   overwritten by stale server data on the next page load.
   */
  mergeUsers(remoteUsers: any[]): any[] {
    const local = readJSON<any>(USERS_KEY);
    const localMap = new Map<string, any>();
    for (const u of local) localMap.set(u.uid, u);

    const result = new Map<string, any>();

    // Start with all remote users
    for (const fu of remoteUsers) {
      const lu = localMap.get(fu.uid);
      if (!lu) {
        // Only on server — use as-is
        result.set(fu.uid, fu);
      } else {
        // In both — merge: server identity + localStorage status (if newer)
        const fsUpdated = fu.updatedAt
          ? (typeof fu.updatedAt.toDate === 'function'
              ? fu.updatedAt.toDate().getTime()
              : new Date(fu.updatedAt).getTime())
          : 0;
        const lsUpdated = lu.updatedAt ? new Date(lu.updatedAt).getTime() : 0;

        const STATUS_FIELDS = ['isVerified', 'isBlocked', 'status', 'verificationStatus',
                               'blockedAt', 'unblockedAt', 'updatedAt'];

        if (lsUpdated >= fsUpdated) {
          // localStorage is newer or same — localStorage status wins
          const merged = { ...fu };
          for (const f of STATUS_FIELDS) {
            if (lu[f] !== undefined) merged[f] = lu[f];
          }
          result.set(fu.uid, merged);
        } else {
          // Server is newer — use server entirely, but sync to localStorage
          result.set(fu.uid, fu);
          // Update localStorage to match server
          localMap.set(fu.uid, { ...lu, ...fu });
        }
      }
    }

    // Add localStorage-only users (not on server)
    for (const lu of local) {
      if (!result.has(lu.uid)) {
        result.set(lu.uid, lu);
      }
    }

    // Persist any sync-backs to localStorage
    writeJSON(USERS_KEY, Array.from(localMap.values()));

    return Array.from(result.values()).sort((a, b) => {
      const ta = a.createdAt?.seconds ?? (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tb = b.createdAt?.seconds ?? (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tb - ta;
    });
  },

  /**
   * Merge API jobs with localStorage demo jobs.
   * Server records take precedence.
   */
  mergeJobs(remoteJobs: any[]): any[] {
    const local = readJSON<any>(JOBS_KEY);
    const map = new Map<string, any>();
    for (const j of local) map.set(j.id, j);
    for (const j of remoteJobs) map.set(j.id, j);
    return Array.from(map.values()).sort((a, b) => {
      const ta = a.createdAt?.seconds ?? (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
      const tb = b.createdAt?.seconds ?? (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
      return tb - ta;
    });
  },
};
