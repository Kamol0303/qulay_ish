import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { applicationService } from '../../services/applicationService';
import { jobService } from '../../services/jobService';
import { Application, Job, Profile } from '../../types';
import MobileCard from '../components/Card';
import ChipFilter from '../components/ChipFilter';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';
import SwipeableRow from '../components/SwipeableRow';

type Row = Application & { job?: Job; worker?: Profile };

export function WorkerApplicationsMobile() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const apps = await applicationService.getByWorker(profile.uid);
      const combined = await Promise.all(
        apps.map(async (app) => ({
          ...app,
          job: await jobService.getById(app.jobId).catch(() => undefined),
        })),
      );
      setRows(combined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  const filtered = status === 'all' ? rows : rows.filter((r) => r.status === status);

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">Arizalarim</h1>
      <ChipFilter
        value={status}
        onChange={setStatus}
        options={[
          { id: 'all', label: 'Hammasi' },
          { id: 'pending', label: 'Kutilmoqda' },
          { id: 'accepted', label: 'Qabul' },
          { id: 'rejected', label: 'Rad' },
        ]}
      />
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Ariza yo‘q</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => (
              <MobileCard key={row.id}>
                <div className="flex justify-between gap-2">
                  <h2 className="font-bold text-sm">{row.job?.title || 'Ish'}</h2>
                  <StatusBadge status={row.status} />
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                  {row.coverLetter || row.message || '—'}
                </p>
              </MobileCard>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

export function EmployerApplicationsMobile() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const apps = await applicationService.getByEmployer(profile.uid);
      const combined = await Promise.all(
        apps.map(async (app) => ({
          ...app,
          worker: await api.users.get(app.workerId).catch(() => undefined),
          job: await jobService.getById(app.jobId).catch(() => undefined),
        })),
      );
      setRows(combined);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  const filtered = status === 'all' ? rows : rows.filter((r) => r.status === status);

  const reject = async (id: string) => {
    await applicationService.reject(id);
    await load();
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">Kelgan arizalar</h1>
      <ChipFilter
        value={status}
        onChange={setStatus}
        options={[
          { id: 'all', label: 'Hammasi' },
          { id: 'pending', label: 'Yangi' },
          { id: 'accepted', label: 'Qabul' },
          { id: 'rejected', label: 'Rad' },
        ]}
      />
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Ariza yo‘q</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((row) => (
              <SwipeableRow
                key={row.id}
                leftLabel="Rad etish"
                onSwipeLeft={row.status === 'pending' ? () => void reject(row.id) : undefined}
              >
                <MobileCard>
                  <div className="flex justify-between gap-2">
                    <h2 className="font-bold text-sm">{row.worker?.fullName || 'Ishchi'}</h2>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{row.job?.title}</p>
                  {row.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button
                        type="button"
                        className="flex-1 min-h-[44px] rounded-xl bg-primary text-primary-foreground text-sm font-bold"
                        onClick={() => void applicationService.approve(row.id).then(load)}
                      >
                        Qabul
                      </button>
                      <button
                        type="button"
                        className="flex-1 min-h-[44px] rounded-xl border border-border text-sm font-bold"
                        onClick={() => void reject(row.id)}
                      >
                        Rad
                      </button>
                    </div>
                  )}
                </MobileCard>
              </SwipeableRow>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}

function StatusBadge({ status }: { status?: string }) {
  const key = status || 'pending';
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800',
    accepted: 'bg-emerald-100 text-emerald-800',
    rejected: 'bg-red-100 text-red-800',
    withdrawn: 'bg-slate-100 text-slate-700',
  };
  return (
    <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${map[key] || map.pending}`}>
      {key}
    </span>
  );
}
