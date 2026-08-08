import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Notification } from '../../types';
import MobileCard from '../components/Card';
import SwipeableRow from '../components/SwipeableRow';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';

export default function NotificationsMobile() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!profile?.uid) return;
    setLoading(true);
    try {
      setRows(await api.notifications.list(profile.uid));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [profile?.uid]);

  const dismiss = async (id: string) => {
    await api.notifications.update(id, { read: true });
    setRows((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">Bildirishnomalar</h1>
      <PullToRefresh onRefresh={load}>
        {loading ? (
          <SkeletonList />
        ) : rows.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-16">Bo‘sh</p>
        ) : (
          <div className="space-y-2">
            {rows.map((n) => (
              <SwipeableRow key={n.id} leftLabel="O‘qildi" onSwipeLeft={() => void dismiss(n.id)}>
                <MobileCard className={n.read ? 'opacity-70' : ''}>
                  <p className="font-bold text-sm">{n.title || n.type}</p>
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                </MobileCard>
              </SwipeableRow>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
