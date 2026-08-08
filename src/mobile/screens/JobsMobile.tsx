import React, { useCallback, useEffect, useState } from 'react';
import { MapPin, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { Job } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { CATEGORIES } from '../../constants/categories';
import { filterJobsForSamarkand } from '../../lib/utils';
import { isIdentityVerified, VERIFICATION_REDIRECT_STATE } from '../../lib/verificationGate';
import ApplyModal from '../../components/ApplyModal';
import MobileCard from '../components/Card';
import ChipFilter from '../components/ChipFilter';
import FAB from '../components/FAB';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';
import { hapticLight } from '../haptics';

export default function JobsMobile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [selected, setSelected] = useState<Job | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.jobs.list({ status: 'open' });
      let filtered = filterJobsForSamarkand(rows, { status: 'open' });
      if (category) filtered = filtered.filter((j) => j.category === category);
      setJobs(filtered);
    } catch {
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [category]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 8000);
    return () => clearInterval(id);
  }, [load]);

  const chips = [
    { id: '', label: 'Hammasi' },
    ...CATEGORIES.slice(0, 8).map((c) => ({ id: c.id, label: c.name })),
  ];

  const onApply = (job: Job) => {
    void hapticLight();
    if (!profile) {
      navigate('/auth?mode=login');
      return;
    }
    if (profile.role !== 'worker') return;
    if (!isIdentityVerified(profile)) {
      navigate('/verification', { state: VERIFICATION_REDIRECT_STATE });
      return;
    }
    setSelected(job);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h1 className="text-xl font-black">Ishlar</h1>
        <p className="text-sm text-muted-foreground">Samarqand bo‘yicha ochiq e’lonlar</p>
      </div>

      <ChipFilter options={chips} value={category} onChange={setCategory} />

      <PullToRefresh onRefresh={load}>
        {loading && jobs.length === 0 ? (
          <SkeletonList />
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted-foreground py-16 text-sm">Hozircha e’lon yo‘q</p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <MobileCard key={job.id}>
                <div className="flex justify-between gap-2 mb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-lg">
                    {job.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-600 inline-flex items-center gap-1">
                    <Banknote size={14} />
                    {(job.price || 0).toLocaleString()} so‘m
                  </span>
                </div>
                <h2 className="font-bold text-base leading-snug">{job.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{job.description}</p>
                <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1">
                  <MapPin size={12} /> {job.district || job.region || 'Samarqand'}
                </p>
                <button
                  type="button"
                  onClick={() => onApply(job)}
                  className="mt-3 w-full min-h-[44px] rounded-2xl bg-primary text-primary-foreground font-bold text-sm"
                >
                  Ariza topshirish
                </button>
              </MobileCard>
            ))}
          </div>
        )}
      </PullToRefresh>

      {profile?.role === 'employer' && (
        <FAB label="E’lon" onClick={() => navigate('/employer/create-job')} />
      )}

      {selected && profile && (
        <ApplyModal
          job={selected}
          profile={profile}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
