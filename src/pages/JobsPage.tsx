import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { api } from '../lib/api';
import { Job } from '../types';
import { Search, MapPin, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import Layout from '../components/Layout';
import JobCard from '../components/JobCard';
import { useAuth } from '../context/AuthContext';
import ApplyModal from '../components/ApplyModal';
import { filterJobsForSamarkand } from '../lib/utils';
import { pointDistanceKm } from '../constants/districts';
import { getCurrentPosition } from '../lib/geolocation';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { isIdentityVerified, VERIFICATION_REDIRECT_STATE } from '../lib/verificationGate';
import { goBack } from '../lib/goBack';

export default function JobsPage() {
  const { profile } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Individual filter states for better clarity and control
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [sortBy, setSortBy] = React.useState('price-low');
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);

  /**
   * Main effect: Fetch and filter jobs from API
   * Triggers whenever any filter state or search query changes
   */
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const loadJobs = async () => {
      try {
        const apiJobs = await api.jobs.list({
          status: 'open',
          ...(profile?.district ? { nearDistrict: profile.district } : {}),
        });
        if (cancelled) return;

        let filtered = filterJobsForSamarkand(apiJobs, { status: 'open' });
        if (searchQuery.trim()) {
          const searchLower = searchQuery.toLowerCase().trim();
          filtered = filtered.filter((job: Job) => {
            const titleMatch = job.title?.toLowerCase().includes(searchLower);
            const descMatch = job.description?.toLowerCase().includes(searchLower);
            return titleMatch || descMatch;
          });
        }

        const distanceOf = (job: Job) => {
          if (!origin) return Number.POSITIVE_INFINITY;
          const km = pointDistanceKm(origin.lat, origin.lng, job.district);
          return km == null ? Number.POSITIVE_INFINITY : km;
        };
        const priced = (job: Job) => (typeof job.price === 'number' ? job.price : Number.POSITIVE_INFINITY);

        if (sortBy === 'price-low') {
          filtered.sort((a: Job, b: Job) => priced(a) - priced(b));
        } else if (sortBy === 'price-high') {
          filtered.sort((a: Job, b: Job) => {
            const ap = typeof a.price === 'number' ? a.price : Number.NEGATIVE_INFINITY;
            const bp = typeof b.price === 'number' ? b.price : Number.NEGATIVE_INFINITY;
            return bp - ap;
          });
        } else if (sortBy === 'nearest') {
          filtered.sort((a: Job, b: Job) => distanceOf(a) - distanceOf(b));
        } else if (sortBy === 'farthest') {
          filtered.sort((a: Job, b: Job) => distanceOf(b) - distanceOf(a));
        }

        setJobs(filtered);
      } catch (error) {
        debugLogger.error('Error fetching jobs:', error);
        if (!cancelled) setJobs([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadJobs();
    const interval = setInterval(loadJobs, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sortBy, searchQuery, profile?.district, origin]);

  /**
   * Clear all filters and reset to defaults
   */
  const handleClearFilters = () => {
    setSearchQuery('');
    setSortBy('price-low');
    setIsFilterOpen(false);
  };

  const useMyLocation = async () => {
    setSortBy('nearest');
    try {
      const pos = await getCurrentPosition();
      setOrigin({ lat: pos.latitude, lng: pos.longitude });
    } catch {
      // Sorting still runs; unknown districts stay at the end.
    }
  };

  const onSortChange = async (value: string) => {
    setSortBy(value);
    if ((value === 'nearest' || value === 'farthest') && !origin) {
      try {
        const pos = await getCurrentPosition();
        setOrigin({ lat: pos.latitude, lng: pos.longitude });
      } catch {
        // Keep the chosen sort even if location is declined.
      }
    }
  };

  const canApply = !profile || profile.role === 'worker';

  const handleApply = (job: Job) => {
    if (!profile) {
      navigate('/auth?mode=login');
      return;
    }
    if (profile.role !== 'worker') return;
    if (!isIdentityVerified(profile)) {
      navigate('/verification', { state: VERIFICATION_REDIRECT_STATE });
      return;
    }
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  return (
    <Layout>
      {canApply && (
        <ApplyModal
          isOpen={isApplyModalOpen}
          onClose={() => setIsApplyModalOpen(false)}
          job={selectedJob}
          profile={profile}
        />
      )}
      <div className="bg-slate-900 pt-16 pb-32 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 skew-x-12 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-emerald-500/5 -skew-x-12 -translate-x-1/4" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <button
            onClick={() => goBack(navigate)}
            className="mb-6 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-2xl text-white font-bold transition-all"
          >
            <ArrowLeft size={18} />
            {t('common.back')}
          </button>
          
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
              {t('jobs.title')}
            </h1>
            <p className="text-slate-400 text-lg mb-10 font-medium max-w-xl">
              {t('jobs.subtitle')}
            </p>
            
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-400 transition-colors" size={20} />
                <input
                  type="text"
                  placeholder={t('jobs.search_placeholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-14 pr-6 py-5 rounded-[24px] border-none focus:ring-4 focus:ring-blue-500/20 outline-none shadow-2xl text-lg bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-900 placeholder:text-blue-400 font-bold transition-all"
                />
              </div>
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="bg-white/10 backdrop-blur-xl border border-white/20 text-white px-8 py-5 rounded-[24px] font-black uppercase tracking-widest flex items-center justify-center hover:bg-white/20 transition-all group"
              >
                <SlidersHorizontal size={20} className="mr-3 group-hover:rotate-180 transition-transform duration-500" />
                {t('jobs.filters')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-20">
        {isFilterOpen && (
            <div className="bg-white rounded-[40px] shadow-2xl border border-slate-100 p-8 mb-12 relative z-20">
              <div className="space-y-2">
                <p className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('jobs.sort_by')}</p>
                <div className="grid grid-cols-1 gap-2">
                  {(
                    [
                      ['price-low', t('jobs.price_low')],
                      ['price-high', t('jobs.price_high')],
                      ['nearest', t('jobs.nearest', { defaultValue: 'Eng yaqin' })],
                      ['farthest', t('jobs.farthest', { defaultValue: 'Eng uzoq' })],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => void onSortChange(value)}
                      className={`min-h-[48px] w-full rounded-2xl border px-4 py-3 text-left font-bold ${
                        sortBy === value
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-800'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  onClick={() => void useMyLocation()}
                  className="text-blue-600 text-xs font-black uppercase tracking-widest flex items-center hover:text-blue-700 transition-colors"
                >
                  <MapPin size={16} className="mr-2" /> {t('jobs.nearby_jobs')}
                </button>
                <button
                  onClick={handleClearFilters}
                  className="text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition-colors"
                >
                  {t('jobs.clear_filters')}
                </button>
              </div>
            </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-8 w-1.5 bg-blue-500 rounded-full" />
            <div className="text-slate-500 font-bold tracking-tight">
              {isLoading ? t('jobs.loading') : t('jobs.found_jobs', { count: jobs.length })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white h-[400px] rounded-[32px] animate-pulse border border-slate-100 shadow-sm"></div>
            ))}
          </div>
        ) : jobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {jobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                onApply={canApply ? () => handleApply(job) : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[48px] p-20 text-center border border-slate-100 shadow-2xl">
            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-200">
              <Search size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
              {t('jobs.no_jobs_found')}
            </h3>
            <p className="text-slate-500 max-w-md mx-auto mb-10 leading-relaxed">{t('jobs.no_jobs_desc')}</p>
            <button
              onClick={handleClearFilters}
              className="bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-blue-200"
            >
              {t('jobs.clear_filters')}
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
}
