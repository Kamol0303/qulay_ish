import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { ServicePost, Profile } from '../../types';
import { Search, MapPin, Briefcase, Star, Filter, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { REGIONS } from '../../constants/locations';
import { SKILLS } from '../../constants/categories';
import { useTranslation } from 'react-i18next';
import { getDistrictKey } from '../../lib/utils';

export default function WorkerServices() {
  const { t } = useTranslation();
  const [posts, setPosts] = useState<(ServicePost & { worker?: Profile })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    region: '',
    search: ''
  });

  useEffect(() => {
    async function fetchServices() {
      setLoading(true);
      try {
        const params: Record<string, string> = { status: 'active' };
        if (filters.category) params.category = filters.category;
        if (filters.region) params.region = filters.region;

        const postsData = await api.servicePosts.list(params);

        const workerIds = [...new Set(postsData.map(p => p.workerId))];
        const profiles: Record<string, Profile> = {};

        await Promise.all(workerIds.map(async (id) => {
          const user = await api.users.get(id).catch(() => null);
          if (user) profiles[id] = user;
        }));

        const combined = postsData.map(p => ({
          ...p,
          worker: profiles[p.workerId]
        }));

        // Client-side search filter
        const filtered = combined.filter(p => 
          p.title.toLowerCase().includes(filters.search.toLowerCase()) ||
          p.description.toLowerCase().includes(filters.search.toLowerCase())
        );

        setPosts(filtered);
      } catch (error) {
        debugLogger.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchServices();
  }, [filters.category, filters.region, filters.search]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('employer.dashboard.worker_services')}</h2>
          <p className="text-muted-foreground mt-2">{t('employer.dashboard.worker_services_desc')}</p>
        </div>

        {/* Filters */}
        <div className="bg-card p-6 rounded-3xl border border-border shadow-sm flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('common.search')}</label>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-3 text-muted-foreground" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
                placeholder={t('common.search_placeholder')}
              />
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('jobs.category')}</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              <option value="">{t('common.all')}</option>
              {SKILLS.map(s => <option key={s.id} value={s.id}>{t(`skills.${s.id}`)}</option>)}
            </select>
          </div>

          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{t('profile.region')}</label>
            <select
              value={filters.region}
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-primary outline-none transition-all"
            >
              <option value="">{t('common.all')}</option>
              {REGIONS.map(r => <option key={r} value={r}>{t('common.region_name', { defaultValue: r })}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-80 bg-secondary/50 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card rounded-3xl border border-border overflow-hidden shadow-sm hover:shadow-lg transition-all group"
              >
                <div className="relative h-48 bg-secondary">
                  {post.images?.[0] ? (
                    <img src={post.images[0]} alt={post.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Briefcase className="w-12 h-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4">
                    <span className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold uppercase tracking-wider shadow-lg">
                      {t(`skills.${post.category}`, { defaultValue: post.category })}
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center overflow-hidden border border-border">
                      {post.worker?.photoUrl ? (
                        <img src={post.worker.photoUrl} alt={post.worker.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-foreground line-clamp-1">{post.worker?.fullName || t('common.unknown_worker')}</h4>
                      <div className="flex items-center gap-1 text-xs text-amber-500 font-bold">
                        <Star className="w-3 h-3 fill-current" />
                        <span>{post.worker?.rating || '0.0'} ({post.worker?.reviewCount || 0})</span>
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 h-14">
                    {post.title}
                  </h3>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{t(`districts.${getDistrictKey(post.district)}`)}, {t('common.region_name', { defaultValue: post.region })}</span>
                    </div>
                    <div className="font-bold text-primary text-lg">
                      {post.expectedPrice.toLocaleString()} {t('common.uzs')}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border flex gap-3">
                    <Link
                      to={`/worker/${post.workerId}`}
                      className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-center font-bold hover:bg-accent transition-all"
                    >
                      {t('profile.view_profile')}
                    </Link>
                    <Link
                      to={`/chat?with=${post.workerId}&related=${post.id}`}
                      className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-center font-bold hover:bg-primary/90 transition-all shadow-md"
                    >
                      {t('common.contact')}
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-3xl p-20 text-center border-2 border-dashed border-border">
            <Search className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-bold text-foreground">{t('common.nothing_found')}</h3>
            <p className="text-muted-foreground mt-2">{t('common.try_changing_filters')}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
