export type PublicStats = {
  users: number;
  jobs: number;
  applications: number;
  contracts: number;
  workers: number | null;
  employers: number | null;
  activeJobs: number;
  pendingApplications: number | null;
  activeContracts: number;
  completedContracts: number | null;
};

type RawStats = Partial<Record<keyof PublicStats, number | null>> | null | undefined;

/** Keeps the landing cards aligned with the super-admin dashboard counts. */
export function normalizePublicStats(data: RawStats): PublicStats {
  return {
    users: Number(data?.users ?? 0),
    jobs: Number(data?.jobs ?? 0),
    applications: Number(data?.applications ?? 0),
    contracts: Number(data?.contracts ?? 0),
    workers: data?.workers == null ? null : Number(data.workers),
    employers: data?.employers == null ? null : Number(data.employers),
    activeJobs: data?.activeJobs == null ? Number(data?.jobs ?? 0) : Number(data.activeJobs),
    pendingApplications: data?.pendingApplications == null ? null : Number(data.pendingApplications),
    activeContracts: data?.activeContracts == null ? Number(data?.contracts ?? 0) : Number(data.activeContracts),
    completedContracts: data?.completedContracts == null ? null : Number(data.completedContracts),
  };
}
