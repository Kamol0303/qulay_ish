import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { api } from '../lib/api';
import { Profile, ServicePost } from '../types';
import { Search, MapPin, SlidersHorizontal, ArrowLeft } from 'lucide-react';
import SafeSelect from '../components/SafeSelect';
import {
  SERVICE_DIRECTIONS,
  isServiceDirection,
  jobMatchesDirection,
  workerMatchesDirection,
} from '../constants/categories';
import Layout from '../components/Layout';
import WorkerCard from '../components/WorkerCard';
import { pointDistanceKm } from '../constants/districts';
import { getCurrentPosition } from '../lib/geolocation';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isValidDistrictId } from '../constants/districts';
import { goBack } from '../lib/goBack';
import { filterWorkersForSamarkand } from '../lib/utils';
import { generateFemaleWorkers, isFemaleFilterSort } from '../lib/generatedWomen';

export default function JobsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [workers, setWorkers] = React.useState<Profile[]>([]);
  const [prices, setPrices] = React.useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [direction, setDirection] = React.useState(() => {
    const picked = searchParams.get('direction') || searchParams.get('search') || '';
    return isServiceDirection(picked) ? picked : '';
  });
  const [districtFilter, setDistrictFilter] = React.useState(() => searchParams.get('district') ?? '');
  const [sortBy, setSortBy] = React.useState('');
  const [origin, setOrigin] = React.useState<{ lat: number; lng: number } | null>(null);
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const loadWorkers = async () => {
      try {
        if (isFemaleFilterSort(sortBy)) {
          if (cancelled) return;
          const generated = generateFemaleWorkers(sortBy, direction);
          setWorkers(generated.workers);
          setPrices(generated.prices);
          return;
        }
        const [listed, posts] = await Promise.all([
          api.users.list({ role: 'worker' }),
          api.servicePosts.list({ status: 'active' }).catch(() => [] as ServicePost[]),
        ]);
        if (cancelled) return;

        const nextPrices: Record<string, number> = {};
        for (const post of posts) {
          const amount = typeof post.price === 'number' ? post.price : post.expectedPrice;
          if (typeof amount !== 'number' || !post.workerId) continue;
          const prev = nextPrices[post.workerId];
          if (prev == null || amount < prev) nextPrices[post.workerId] = amount;
        }
        setPrices(nextPrices);

        let filtered = filterWorkersForSamarkand(listed, {
          ...(isValidDistrictId(districtFilter) ? { district: districtFilter } : {}),
        });
        if (direction) {
          filtered = filtered.filter((worker) => {
            if (workerMatchesDirection(worker, direction)) return true;
            return posts.some(
              (post) =>
                post.workerId === worker.uid &&
                jobMatchesDirection(
                  { category: post.category, title: post.title, description: post.description },
                  direction,
                ),
            );
          });
        }

        const distanceOf = (worker: Profile) => {
          if (!origin) return Number.POSITIVE_INFINITY;
          const km = pointDistanceKm(origin.lat, origin.lng, worker.district);
          return km == null ? Number.POSITIVE_INFINITY : km;
        };
        const priceOf = (worker: Profile) => nextPrices[worker.uid] ?? Number.POSITIVE_INFINITY;

        if (sortBy === 'price-low') {
          filtered.sort((a, b) => priceOf(a) - priceOf(b));
        } else if (sortBy === 'price-high') {
          filtered.sort((a, b) => {
            const ap = nextPrices[a.uid] ?? Number.NEGATIVE_INFINITY;
            const bp = nextPrices[b.uid] ?? Number.NEGATIVE_INFINITY;
            return bp - ap;
          });
        } else if (sortBy === 'nearest') {
          filtered.sort((a, b) => distanceOf(a) - distanceOf(b));
        } else if (sortBy === 'farthest') {
          filtered.sort((a, b) => distanceOf(b) - distanceOf(a));
        }

        setWorkers(filtered);
      } catch (error) {
        debugLogger.error('Error fetching workers:', error);
        if (!cancelled) setWorkers([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadWorkers();
    const interval = setInterval(loadWorkers, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sortBy, direction, districtFilter, origin]);

  const handleClearFilters = () => {
    setDirection('');
    setDistrictFilter('');
    setSortBy('');
    setIsFilterOpen(false);
    setSearchParams({}, { replace: true });
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

  return (
    <Layout>
      <div className="bg-slate-900 pt-16 pb-32 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/10 skew-x-12 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-emerald-500/5 -skew-x-12 -translate-x-1/4" />
        </div>

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
              <div className="flex-1 relative">
                <Search className="pointer-events-none absolute left-5 top-5 text-blue-700" size={20} />
                <SafeSelect
                  id="job-direction"
                  value={direction}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDirection(isServiceDirection(next) ? next : '');
                    const params = new URLSearchParams(searchParams);
                    params.delete('search');
                    if (isServiceDirection(next)) params.set('direction', next);
                    else params.delete('direction');
                    setSearchParams(params, { replace: true });
                  }}
                  className="w-full min-h-[64px] rounded-[24px] bg-white pl-14 pr-6 py-5 text-left text-lg font-bold text-slate-900 shadow-2xl"
                >
                  <option value="">{t('jobs.all_directions')}</option>
                  {SERVICE_DIRECTIONS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {t(`jobs.directions.${item.id}`, { defaultValue: item.name })}
                    </option>
                  ))}
                </SafeSelect>
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
              {isLoading ? t('jobs.loading') : t('jobs.found_jobs', { count: workers.length })}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white h-[400px] rounded-[32px] animate-pulse border border-slate-100 shadow-sm"></div>
            ))}
          </div>
        ) : workers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {workers.map((worker) => (
              <WorkerCard key={worker.uid} worker={worker} price={prices[worker.uid]} />
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
