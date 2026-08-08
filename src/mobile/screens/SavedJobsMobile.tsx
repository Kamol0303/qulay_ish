import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Job } from '../../types';
import MobileCard from '../components/Card';
import SwipeableRow from '../components/SwipeableRow';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';

export default function SavedJobsMobile() {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<Array<{ id: string; jobId: string; job?: Job }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      setJobs(await api.savedJobs.list(profile.uid));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">Saqlangan ishlar</h1>
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <SkeletonList />
        ) : jobs.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Ro‘yxat bo‘sh</p>
        ) : (
          <div className="space-y-2">
            {jobs.map((row) => (
              <SwipeableRow
                key={row.id}
                leftLabel="Olib tashlash"
                onSwipeLeft={() =>
                  void api.savedJobs.remove(profile!.uid, row.jobId).then(load)
                }
              >
                <MobileCard>
                  <p className="font-bold text-sm">{row.job?.title || row.jobId}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {(row.job?.price || 0).toLocaleString()} so‘m
                  </p>
                </MobileCard>
              </SwipeableRow>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
