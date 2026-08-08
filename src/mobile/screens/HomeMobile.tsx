import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Briefcase, Users, FileText, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import MobileCard from '../components/Card';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';

export default function HomeMobile() {
  const { profile, userRole, loading } = useAuth();
  const role = userRole || profile?.role;
  const [stats, setStats] = useState({ users: 0, jobs: 0, applications: 0, contracts: 0 });
  const [busy, setBusy] = useState(true);

  const load = async () => {
    try {
      const s = await api.stats.counts();
      setStats(s);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (!loading && role === 'worker') return <Navigate to="/worker/dashboard" replace />;
  if (!loading && role === 'employer') return <Navigate to="/employer/dashboard" replace />;
  if (!loading && role === 'super_admin') return <Navigate to="/super-admin/dashboard" replace />;
  if (!loading && role === 'admin') return <Navigate to="/admin/dashboard" replace />;

  return (
    <PullToRefresh onRefresh={load}>
      <div className="px-4 py-5 space-y-5">
        <section className="rounded-3xl bg-gradient-to-br from-primary to-blue-700 text-primary-foreground p-6 shadow-lg">
          <p className="text-sm font-semibold opacity-90">ishliayol.uz</p>
          <h1 className="text-2xl font-black mt-1 leading-tight">Samarqandda ish toping</h1>
          <p className="text-sm mt-2 opacity-90">Ishchi va ish beruvchilar uchun yagona platforma.</p>
          <div className="flex gap-2 mt-5">
            <Link
              to="/jobs"
              className="min-h-[44px] inline-flex items-center gap-2 rounded-2xl bg-white text-primary px-4 font-bold text-sm"
            >
              Ishlar <ArrowRight size={16} />
            </Link>
            <Link
              to="/auth"
              className="min-h-[44px] inline-flex items-center rounded-2xl border border-white/40 px-4 font-bold text-sm"
            >
              Kirish
            </Link>
          </div>
        </section>

        {busy ? (
          <SkeletonList count={3} />
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <MobileCard>
              <Briefcase className="text-primary mb-2" size={22} />
              <p className="text-2xl font-black">{stats.jobs}</p>
              <p className="text-xs text-muted-foreground font-medium">Ish e’lonlari</p>
            </MobileCard>
            <MobileCard>
              <Users className="text-primary mb-2" size={22} />
              <p className="text-2xl font-black">{stats.users}</p>
              <p className="text-xs text-muted-foreground font-medium">Foydalanuvchilar</p>
            </MobileCard>
            <MobileCard>
              <FileText className="text-primary mb-2" size={22} />
              <p className="text-2xl font-black">{stats.applications}</p>
              <p className="text-xs text-muted-foreground font-medium">Arizalar</p>
            </MobileCard>
            <MobileCard>
              <FileText className="text-primary mb-2" size={22} />
              <p className="text-2xl font-black">{stats.contracts}</p>
              <p className="text-xs text-muted-foreground font-medium">Shartnomalar</p>
            </MobileCard>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
