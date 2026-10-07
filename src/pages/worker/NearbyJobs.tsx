import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/DashboardLayout';
import { api } from '../../lib/api';
import { Job } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import { getCurrentPosition, isGeolocationAvailable } from '../../lib/geolocation';
import { getDistrictKey } from '../../lib/utils';
import { CATEGORIES } from '../../constants/categories';
import { REGIONS } from '../../constants/locations';
import { isIdentityVerified, VERIFICATION_REDIRECT_STATE } from '../../lib/verificationGate';
import ApplyModal from '../../components/ApplyModal';
import { MapPin, Search, Banknote, Loader2, Navigation, Briefcase } from 'lucide-react';

const RADIUS_OPTIONS = [10, 30, 50, 100] as const;
const PAGE_SIZE = 12;

export default function NearbyJobs() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [category, setCategory] = useState('');
  const [region, setRegion] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [selected, setSelected] = useState<Job | null>(null);

  const runNearby = useCallback(
    async (lat: number, lng: number, pageArg = 1, radiusArg = radiusKm) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.jobs.nearby({
          lat,
          lng,
          radius_km: radiusArg,
          category: category || undefined,
          region: region || undefined,
          page: pageArg,
          pageSize: PAGE_SIZE,
        });
        setJobs(res.data);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
        setSearched(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t('nearby_jobs.search_error', { defaultValue: 'Qidiruvda xatolik' }));
      } finally {
        setLoading(false);
      }
    },
    [radiusKm, category, region, t],
  );

  const useMyLocation = useCallback(async () => {
    setError('');
    if (!isGeolocationAvailable()) {
      setError(t('nearby_jobs.no_geo', { defaultValue: 'Qurilma lokatsiyani qoʻllab-quvvatlamaydi.' }));
      return;
    }
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.latitude, lng: pos.longitude });
      await runNearby(pos.latitude, pos.longitude, 1, radiusKm);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('nearby_jobs.no_location', { defaultValue: 'Lokatsiya olinmadi' }));
      setLoading(false);
    }
  }, [radiusKm, runNearby, t]);

  const changeRadius = (r: number) => {
    setRadiusKm(r);
    if (coords) void runNearby(coords.lat, coords.lng, 1, r);
  };

  const goPage = (p: number) => {
    if (coords) void runNearby(coords.lat, coords.lng, p, radiusKm);
  };

  const onApply = (job: Job) => {
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
    <DashboardLayout title={t('nearby_jobs.title', { defaultValue: 'Yaqin atrofdagi ishlar' })}>
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {t('jobs.category', { defaultValue: 'Kasb' })}
              </label>
              <div className="relative">
                <Briefcase className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-border pl-9 pr-3 text-sm"
                >
                  <option value="">{t('jobs.all_categories', { defaultValue: 'Barcha toifalar' })}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>{t(`categories.${c.id}`, { defaultValue: c.name })}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                {t('jobs.region', { defaultValue: 'Hudud' })}
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-border px-3 text-sm sm:w-48"
              >
                <option value="">{t('common.all', { defaultValue: 'Barchasi' })}</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => void useMyLocation()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white"
            >
              <Navigation className="h-4 w-4" /> {t('nearby_jobs.use_location', { defaultValue: 'Yaqinimdagi ishlar' })}
            </button>
            <span className="text-xs text-muted-foreground">{t('nearby_jobs.radius', { defaultValue: 'Radius' })}:</span>
            {RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => changeRadius(r)}
                className={`min-h-[44px] rounded-xl px-3 text-sm font-semibold ${
                  radiusKm === r ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'
                }`}
              >
                {r} km
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t('common.loading', { defaultValue: 'Yuklanmoqda…' })}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <MapPin className="h-8 w-8" />
            <p>
              {searched
                ? t('nearby_jobs.empty', { defaultValue: 'Yaqin atrofda ochiq e\'lon topilmadi. Radiusni kattalashtiring.' })
                : t('nearby_jobs.hint', { defaultValue: '“Yaqinimdagi ishlar” tugmasini bosing.' })}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {t('nearby_jobs.result_note', {
                defaultValue: '~{{radius}} km radiusdagi ochiq e\'lonlar (taxminiy masofa).',
                radius: radiusKm,
              })}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-lg bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                      {t(`categories.${job.category}`, { defaultValue: job.category })}
                    </span>
                    {job.distanceLabel && (
                      <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
                        {job.distanceLabel}
                      </span>
                    )}
                  </div>
                  <h2 className="font-bold leading-snug">{job.title}</h2>
                  {job.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {[job.region, job.district ? t(`districts.${getDistrictKey(job.district)}`, { defaultValue: job.district }) : null]
                        .filter(Boolean)
                        .join(', ') || 'Samarqand'}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <Banknote size={14} />
                      {(job.price || 0).toLocaleString()} {t('common.uzs', { defaultValue: 'soʻm' })}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onApply(job)}
                    className="mt-auto inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                  >
                    {t('common.apply', { defaultValue: 'Ariza topshirish' })}
                  </button>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                  className="min-h-[44px] rounded-xl bg-secondary px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {t('common.previous', { defaultValue: 'Oldingi' })}
                </button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => goPage(page + 1)}
                  className="min-h-[44px] rounded-xl bg-secondary px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {t('common.next', { defaultValue: 'Keyingi' })}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selected && profile && (
        <ApplyModal
          job={selected}
          profile={profile}
          isOpen={!!selected}
          onClose={() => setSelected(null)}
        />
      )}
    </DashboardLayout>
  );
}
