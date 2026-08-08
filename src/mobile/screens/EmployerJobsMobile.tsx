import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { jobService } from '../../services/jobService';
import { Job } from '../../types';
import MobileCard from '../components/Card';
import FAB from '../components/FAB';
import ChipFilter from '../components/ChipFilter';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';

export default function EmployerJobsMobile() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      setJobs(await jobService.getByEmployer(profile.uid));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  const filtered = status === 'all' ? jobs : jobs.filter((j) => j.status === status);

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">E’lonlarim</h1>
      <ChipFilter
        value={status}
        onChange={setStatus}
        options={[
          { id: 'all', label: 'Hammasi' },
          { id: 'open', label: 'Ochiq' },
          { id: 'closed', label: 'Yopiq' },
          { id: 'draft', label: 'Qoralama' },
        ]}
      />
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">E’lon yo‘q</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((job) => (
              <MobileCard key={job.id} onClick={() => navigate(`/employer/jobs/${job.id}`)}>
                <div className="flex justify-between gap-2">
                  <h2 className="font-bold text-sm">{job.title}</h2>
                  <span className="text-[10px] font-black uppercase text-primary">{job.status}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {(job.price || 0).toLocaleString()} so‘m · {job.district || job.region}
                </p>
              </MobileCard>
            ))}
          </div>
        )}
      </PullToRefresh>
      <FAB label="E’lon" onClick={() => navigate('/employer/create-job')} />
    </div>
  );
}
