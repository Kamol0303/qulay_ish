import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { applicationService } from '../../services/applicationService';
import { contractService } from '../../services/contractService';
import { jobService } from '../../services/jobService';
import MobileCard from '../components/Card';
import FAB from '../components/FAB';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';
import { useNavigate } from 'react-router-dom';

export function WorkerDashboardMobile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ apps: 0, contracts: 0, done: 0, earnings: 0 });

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const [apps, contracts] = await Promise.all([
        applicationService.getByWorker(profile.uid),
        contractService.getByWorker(profile.uid),
      ]);
      setStats({
        apps: apps.filter((a) => a.status === 'pending').length,
        contracts: contracts.filter((c) => c.status === 'active').length,
        done: contracts.filter((c) => c.status === 'completed').length,
        earnings: contracts
          .filter((c) => c.status === 'completed')
          .reduce((s, c) => s + (c.amount || 0), 0),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 py-5 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Salom</p>
          <h1 className="text-xl font-black">{profile?.fullName || 'Ishchi'}</h1>
        </div>
        {loading ? (
          <SkeletonList count={2} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Clock} label="Kutilayotgan" value={stats.apps} />
            <Stat icon={CheckCircle} label="Faol shartnoma" value={stats.contracts} />
            <Stat icon={Briefcase} label="Yakunlangan" value={stats.done} />
            <Stat icon={TrendingUp} label="Daromad" value={`${stats.earnings.toLocaleString()}`} />
          </div>
        )}
        <div className="space-y-2">
          <Quick to="/jobs" label="Ishlar ro‘yxati" />
          <Quick to="/worker/applications" label="Arizalarim" />
          <Quick to="/verification" label="Tasdiqlash" />
          <Quick to="/saved-jobs" label="Saqlangan ishlar" />
        </div>
        <FAB label="Ishlar" onClick={() => navigate('/jobs')} />
      </div>
    </PullToRefresh>
  );
}

export function EmployerDashboardMobile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ jobs: 0, apps: 0, contracts: 0 });

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      const [jobs, apps, contracts] = await Promise.all([
        jobService.getByEmployer(profile.uid),
        applicationService.getByEmployer(profile.uid),
        contractService.getByEmployer(profile.uid),
      ]);
      setStats({
        jobs: jobs.filter((j) => j.status === 'open' || j.status === 'active').length,
        apps: apps.length,
        contracts: contracts.filter((c) => c.status === 'active').length,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 py-5 space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Tashkilot</p>
          <h1 className="text-xl font-black">{profile?.fullName || 'Ish beruvchi'}</h1>
        </div>
        {loading ? (
          <SkeletonList count={2} />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Briefcase} label="E’lonlar" value={stats.jobs} />
            <Stat icon={Clock} label="Arizalar" value={stats.apps} />
            <Stat icon={CheckCircle} label="Shartnoma" value={stats.contracts} />
          </div>
        )}
        <div className="space-y-2">
          <Quick to="/employer/applicants" label="Arizalarni ko‘rish" />
          <Quick to="/employer/jobs" label="E’lonlarim" />
          <Quick to="/verification" label="Tasdiqlash" />
        </div>
        <FAB label="E’lon" onClick={() => navigate('/employer/create-job')} />
      </div>
    </PullToRefresh>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <MobileCard className="!p-3">
      <Icon size={18} className="text-primary mb-1" />
      <p className="text-lg font-black leading-none">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 font-medium">{label}</p>
    </MobileCard>
  );
}

function Quick({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="min-h-[48px] flex items-center justify-between rounded-2xl border border-border bg-card px-4 font-semibold text-sm"
    >
      {label}
      <span className="text-primary">→</span>
    </Link>
  );
}
