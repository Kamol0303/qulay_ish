import React from 'react';
import { api } from '../lib/api';
import { Profile, ServicePost } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, SlidersHorizontal, Filter, ChevronDown, ArrowLeft, Play, BookOpen } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';
import { pointDistanceKm } from '../constants/districts';
import Layout from '../components/Layout';
import WorkerCard from '../components/WorkerCard';
import { useAuth } from '../hooks/useAuth';
import { cn, filterWorkersForSamarkand } from '../lib/utils';
import { getCurrentPosition } from '../lib/geolocation';
import { useNavigate } from 'react-router-dom';

import { useTranslation } from 'react-i18next';

export default function WorkersPage() {
  const { profile: myProfile } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [workers, setWorkers] = React.useState<Profile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [filters, setFilters] = React.useState({
    skill: '',
    sortBy: 'price-low',
  });
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [selectedVideo, setSelectedVideo] = React.useState<string | null>(null);

  // YouTube videos for workers
  const workerVideos = [
    {
      id: 'dQw4w9WgXcQ',
      titleUz: 'Tikuvchilik asoslari',
      titleRu: 'Основы шитья',
      titleEn: 'Sewing Basics',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    },
    {
      id: 'dQw4w9WgXcQ',
      titleUz: 'To\'qimachilik san\'ati',
      titleRu: 'Искусство вязания',
      titleEn: 'Knitting Art',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    },
    {
      id: 'dQw4w9WgXcQ',
      titleUz: 'Bisser bilan ishlash',
      titleRu: 'Работа с бисером',
      titleEn: 'Beadwork',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
    }
  ];

  const getVideoTitle = (video: typeof workerVideos[0]) => {
    switch (i18n.language) {
      case 'ru': return video.titleRu;
      case 'en': return video.titleEn;
      default: return video.titleUz;
    }
  };

  React.useEffect(() => {
    let cancelled = false;

    const loadWorkers = async () => {
      try {
        const [listed, posts] = await Promise.all([
          api.users.list({ role: 'worker' }),
          api.servicePosts.list({ status: 'active' }).catch(() => [] as ServicePost[]),
        ]);
        if (cancelled) return;

        const nextPrices: Record<string, number> = {};
        for (const post of posts) {
          const amount = typeof post.price === 'number' ? post.price : post.expectedPrice;
          if (typeof amount !== 'number' || !post.workerId) continue;
          if (filters.skill && post.category && post.category !== filters.skill) continue;
          const prev = nextPrices[post.workerId];
          if (prev == null || amount < prev) nextPrices[post.workerId] = amount;
        }
        setPrices(nextPrices);

        let workersData = filterWorkersForSamarkand(listed);
        if (filters.skill) {
          workersData = workersData.filter(
            (w) => w.profession === filters.skill || w.skills?.includes(filters.skill),
          );
        }

        const distanceOf = (worker: Profile) => {
          if (!origin) return Number.POSITIVE_INFINITY;
          const km = pointDistanceKm(origin.lat, origin.lng, worker.district);
          return km == null ? Number.POSITIVE_INFINITY : km;
        };
        const priceOf = (worker: Profile) => nextPrices[worker.uid] ?? Number.POSITIVE_INFINITY;

        if (filters.sortBy === 'price-low') {
          workersData.sort((a, b) => priceOf(a) - priceOf(b));
        } else if (filters.sortBy === 'price-high') {
          workersData.sort((a, b) => {
            const ap = nextPrices[a.uid] ?? Number.NEGATIVE_INFINITY;
            const bp = nextPrices[b.uid] ?? Number.NEGATIVE_INFINITY;
            return bp - ap;
          });
        } else if (filters.sortBy === 'nearest') {
          workersData.sort((a, b) => distanceOf(a) - distanceOf(b));
        } else if (filters.sortBy === 'farthest') {
          workersData.sort((a, b) => distanceOf(b) - distanceOf(a));
        }

        setWorkers(workersData);
      } catch {
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadWorkers();
    const interval = setInterval(loadWorkers, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [filters, origin]);

  const filteredWorkers = workers.filter(worker => 
    worker.fullName.toLowerCase().includes(search.toLowerCase()) ||
    worker.bio?.toLowerCase().includes(search.toLowerCase())
  );

  const clearFilters = () => {
    setFilters({ skill: '', sortBy: 'price-low' });
  };

  const onSortChange = async (value: string) => {
    setFilters((prev) => ({ ...prev, sortBy: value }));
    if ((value === 'nearest' || value === 'farthest') && !origin) {
      try {
        const pos = await getCurrentPosition();
        setOrigin({ lat: pos.latitude, lng: pos.longitude });
      } catch {
        // Distance sort stays in place if location is declined.
      }
    }
  };

  return (
    <Layout>
      <div className="relative bg-slate-900 dark:bg-slate-950 pt-24 pb-32 overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse delay-700" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <button
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white font-bold transition-all"
          >
            <ArrowLeft size={18} />
            {t('common.back')}
          </button>
          
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
                {t('workers.subtitle')}
              </span>
              <h1 className="text-4xl md:text-6xl font-black text-white mb-8 tracking-tight leading-[1.1]">
                {t('workers.title')}
              </h1>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex flex-col md:flex-row gap-4"
            >
              <div className="flex-1 relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder={t('workers.search_placeholder')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-[2rem] bg-blue-500/20 border border-blue-400/30 text-white placeholder:text-blue-200/70 focus:ring-4 focus:ring-blue-500/40 focus:border-blue-400 outline-none transition-all text-lg font-bold backdrop-blur-xl"
                />
              </div>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className={cn(
                  "px-8 py-5 rounded-[2rem] font-black uppercase tracking-widest flex items-center justify-center transition-all duration-500 border backdrop-blur-xl",
                  isFilterOpen 
                    ? "bg-blue-500 border-blue-500 text-white shadow-xl shadow-blue-500/40" 
                    : "bg-white/5 border-white/10 text-white hover:bg-white/10"
                )}
              >
                <SlidersHorizontal size={20} className={cn("mr-3 transition-transform duration-500", isFilterOpen && "rotate-180")} />
                {t('workers.filters')}
              </button>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 relative z-20">
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-card dark:bg-slate-800 rounded-3xl shadow-xl border border-border p-6 mb-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('workers.skill')}</label>
                  <div className="relative">
                    <select
                      value={filters.skill}
                      onChange={(e) => setFilters({ ...filters, skill: e.target.value })}
                      className="w-full appearance-none px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">{t('workers.all')}</option>
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {t(`categories.${c.id}`, { defaultValue: c.name })}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-700/50 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('workers.sort_by')}</label>
                  <div className="relative">
                    <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-400" />
                    <select
                      value={filters.sortBy}
                      onChange={(e) => void onSortChange(e.target.value)}
                      className="w-full appearance-none pl-11 pr-10 py-3 rounded-xl border border-purple-200 bg-purple-50 dark:bg-purple-900/30 text-purple-900 dark:text-purple-100 font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="price-low">{t('jobs.price_low')}</option>
                      <option value="price-high">{t('jobs.price_high')}</option>
                      <option value="nearest">{t('jobs.nearest')}</option>
                      <option value="farthest">{t('jobs.farthest', { defaultValue: 'Eng uzoq' })}</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-purple-700/50 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={clearFilters}
                  className="text-gray-400 text-sm font-bold hover:text-gray-600"
                >
                  {t('workers.clear_filters')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between mb-8">
          <div className="text-gray-500 font-medium">
            {loading ? t('workers.loading') : t('workers.found_workers', { count: filteredWorkers.length })}
          </div>
        </div>

        {/* YouTube Videos Section - Only for workers */}
        {myProfile?.role === 'worker' && (
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <BookOpen className="text-blue-600" size={28} />
              <h2 className="text-2xl font-black text-gray-900">
                {i18n.language === 'ru' ? 'Обучающие видео' : i18n.language === 'en' ? 'Training Videos' : 'O\'quv videolari'}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {workerVideos.map((video, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 hover:shadow-2xl transition-all cursor-pointer group"
                  onClick={() => setSelectedVideo(video.id)}
                >
                  <div className="relative h-48 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center overflow-hidden">
                    <div className="absolute inset-0 bg-black/20" />
                    <Play size={56} className="text-white relative z-10 group-hover:scale-110 transition-transform" />
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-center">{getVideoTitle(video)}</h3>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white h-64 rounded-3xl animate-pulse border border-gray-100"></div>
            ))}
          </div>
        ) : filteredWorkers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredWorkers.map(worker => (
              <WorkerCard key={worker.uid} worker={worker} price={prices[worker.uid]} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-3xl p-20 text-center border border-gray-100">
            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('workers.no_workers_found')}</h3>
            <p className="text-gray-500">{t('workers.no_workers_desc')}</p>
          </div>
        )}

        {/* Video Modal */}
        {selectedVideo && (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedVideo(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white rounded-3xl overflow-hidden max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="aspect-video">
                <iframe
                  width="100%"
                  height="100%"
                  src={`https://www.youtube.com/embed/${selectedVideo}?autoplay=1`}
                  title="Video"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              <div className="p-6 flex justify-end">
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="px-6 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-gray-700 transition-all"
                >
                  {i18n.language === 'ru' ? 'Закрыть' : i18n.language === 'en' ? 'Close' : 'Yopish'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </Layout>
  );
}
