import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { api } from '../lib/api';
import { Job } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Filter, X, ChevronDown, SlidersHorizontal, Briefcase, Clock, DollarSign, ArrowLeft } from 'lucide-react';
import { REGIONS, DISTRICTS } from '../constants/locations';
import { CATEGORIES } from '../constants/categories';
import Layout from '../components/Layout';
import JobCard from '../components/JobCard';
import { useAuth } from '../context/AuthContext';
import ApplyModal from '../components/ApplyModal';
import { getDistrictKey, filterJobsForSamarkand } from '../lib/utils';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { demoStore } from '../lib/demoStore';
import { DEMO_JOBS } from '../constants/demoData';

export default function JobsPage() {
  const { profile, isDemo } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Individual filter states for better clarity and control
  const [jobs, setJobs] = React.useState<Job[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedRegion, setSelectedRegion] = React.useState('Samarqand viloyati');
  const [selectedDistrict, setSelectedDistrict] = React.useState('');
  const [selectedCategory, setSelectedCategory] = React.useState('');
  const [sortBy, setSortBy] = React.useState('newest');
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [selectedJob, setSelectedJob] = React.useState<Job | null>(null);
  const [isApplyModalOpen, setIsApplyModalOpen] = React.useState(false);

  /**
   * Main effect: Fetch and filter jobs from Firestore
   * Triggers whenever any filter state or search query changes
   */
  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const toMillis = (val: unknown) => {
      if (!val) return 0;
      if (typeof val === 'object' && val !== null && 'seconds' in val) {
        return Number((val as { seconds: number }).seconds) * 1000;
      }
      return new Date(val as string | number | Date).getTime() || 0;
    };

    const loadJobs = async () => {
      try {
        const apiJobs = await api.jobs.list({ status: 'open' });
        if (cancelled) return;

        const mergedJobs = isDemo ? demoStore.mergeJobs([...DEMO_JOBS, ...apiJobs]) : apiJobs;

        let filtered = filterJobsForSamarkand(mergedJobs, {
          status: 'open',
          district: selectedDistrict || undefined,
        });
        if (selectedCategory) {
          filtered = filtered.filter((job: Job) => job.category === selectedCategory);
        }
        if (searchQuery.trim()) {
          const searchLower = searchQuery.toLowerCase().trim();
          filtered = filtered.filter((job: Job) => {
            const titleMatch = job.title?.toLowerCase().includes(searchLower);
            const descMatch = job.description?.toLowerCase().includes(searchLower);
            return titleMatch || descMatch;
          });
        }

        if (sortBy === 'price-low') {
          filtered.sort((a: Job, b: Job) => (a.price || 0) - (b.price || 0));
        } else if (sortBy === 'price-high') {
          filtered.sort((a: Job, b: Job) => (b.price || 0) - (a.price || 0));
        } else if (sortBy === 'newest') {
          filtered.sort((a: Job, b: Job) => toMillis(b.createdAt) - toMillis(a.createdAt));
        }

        setJobs(filtered);
      } catch (error) {
        debugLogger.error('Error fetching jobs:', error);
        if (!cancelled) {
          let fallbackJobs = demoStore.mergeJobs(DEMO_JOBS)
            .filter((j: Job) => j.status === 'open' && j.region === selectedRegion) as Job[];
          if (selectedDistrict) fallbackJobs = fallbackJobs.filter((j: Job) => j.district === selectedDistrict);
          if (selectedCategory) fallbackJobs = fallbackJobs.filter((j: Job) => j.category === selectedCategory);
          setJobs(fallbackJobs);
        }
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
  }, [selectedRegion, selectedDistrict, selectedCategory, sortBy, searchQuery]);

  /**
   * Clear all filters and reset to defaults
   */
  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRegion('Samarqand viloyati');
    setSelectedDistrict('');
    setSelectedCategory('');
    setSortBy('newest');
    setIsFilterOpen(false);
  };

  /**
   * Set filters based on user's profile location
   */
  const useMyLocation = () => {
    if (profile?.region) {
      setSelectedRegion(profile.region);
      setSelectedDistrict(profile.district || '');
    }
  };

  /**
   * Remove region filter by clicking X badge
   */
  const handleRemoveRegionFilter = () => {
    setSelectedRegion('Samarqand viloyati');
    setSelectedDistrict('');
  };

  const handleApply = (job: Job) => {
    if (!profile) {
      navigate('/auth?mode=login');
      return;
    }
    setSelectedJob(job);
    setIsApplyModalOpen(true);
  };

  return (
    <Layout>
      <ApplyModal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        job={selectedJob}
        profile={profile}
      />
      <div className="bg-slate-900 pt-16 pb-32 relative overflow-hidden">
        {/* Background Accents */}
        <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 skew-x-12 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-emerald-500/5 -skew-x-12 -translate-x-1/4" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <button
            onClick={() => navigate(-1)}
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
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="bg-white rounded-[40px] shadow-2xl border border-slate-100 p-8 mb-12 relative z-20"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('jobs.district')}</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <select
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 rounded-2xl border border-blue-200 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-blue-900"
                    >
                      <option value="">{t('jobs.all_districts')}</option>
                      {DISTRICTS["Samarqand viloyati"].map(d => <option key={d} value={d}>{t(`districts.${getDistrictKey(d)}`)}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('jobs.category')}</label>
                  <div className="relative">
                    <Briefcase size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 rounded-2xl border border-emerald-200 bg-emerald-50 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-emerald-900"
                    >
                      <option value="">{t('jobs.all_categories')}</option>
                      {CATEGORIES.map(c => <option key={c.id} value={c.id}>{t(`categories.${c.id}`)}</option>)}
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">{t('jobs.sort_by')}</label>
                  <div className="relative">
                    <Filter size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full pl-11 pr-4 py-4 rounded-2xl border border-purple-200 bg-purple-50 focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-purple-900"
                    >
                      <option value="newest">{t('jobs.newest')}</option>
                      <option value="price-low">{t('jobs.price_low')}</option>
                      <option value="price-high">{t('jobs.price_high')}</option>
                    </select>
                    <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
                  </div>
                </div>
              </div>
              <div className="mt-8 pt-8 border-t border-slate-50 flex flex-col sm:flex-row justify-between items-center gap-4">
                <button
                  onClick={useMyLocation}
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
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-4">
          <div className="flex items-center gap-4">
            <div className="h-8 w-1.5 bg-blue-500 rounded-full" />
            <div className="text-slate-500 font-bold tracking-tight">
              {isLoading ? t('jobs.loading') : t('jobs.found_jobs', { count: jobs.length })}
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {selectedRegion && selectedRegion !== 'Samarqand viloyati' ? (
              <span className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center border border-blue-100">
                {selectedRegion} 
                <X 
                  size={14} 
                  className="ml-2 cursor-pointer hover:text-blue-800 transition-colors" 
                  onClick={handleRemoveRegionFilter}
                />
              </span>
            ) : null}
            {selectedCategory && (
              <span className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center border border-emerald-100">
                {t(`categories.${selectedCategory}`, { defaultValue: selectedCategory })} 
                <X 
                  size={14} 
                  className="ml-2 cursor-pointer hover:text-emerald-800 transition-colors" 
                  onClick={() => setSelectedCategory('')}
                />
              </span>
            )}
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
              <JobCard key={job.id} job={job} onApply={() => handleApply(job)} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-[48px] p-20 text-center border border-slate-100 shadow-2xl">
            <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 text-slate-200">
              <Search size={48} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
              Afsuski, ushbu filtrlar bo'yicha hech qanday ish topilmadi.
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
