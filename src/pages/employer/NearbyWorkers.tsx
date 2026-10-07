import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../../components/DashboardLayout';
import { api, type EmployerWorker } from '../../lib/api';
import { getCurrentPosition, isGeolocationAvailable } from '../../lib/geolocation';
import { useAuth } from '../../hooks/useAuth';
import { SKILLS } from '../../constants/categories';
import { REGIONS } from '../../constants/locations';
import { MapPin, Search, Phone, BadgeCheck, Loader2, User, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';

const RADIUS_OPTIONS = [10, 30, 50, 100] as const;
const PAGE_SIZE = 12;

function WorkerCardItem({ w }: { w: EmployerWorker }) {
  const { t } = useTranslation();
  const skillLabel = (id: string): string =>
    t(`skills.${id}`, { defaultValue: SKILLS.find((s) => s.id === id)?.name || id });
  const name = `${w.firstName ?? ''} ${w.lastName ?? ''}`.trim() || w.fullName || 'Ishchi';
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-primary/10 flex items-center justify-center">
          {w.photoUrl ? (
            <img src={w.photoUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <User className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link to={`/worker/${w.uid}`} className="font-bold truncate hover:text-primary">
              {name}
            </Link>
            {w.isVerified && <BadgeCheck className="h-4 w-4 text-emerald-600 shrink-0" />}
            {w.availability === 'busy' && (
              <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                {t('workers.busy', { defaultValue: 'Band' })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {[w.region, w.district].filter(Boolean).join(', ') || '—'}
          </p>
        </div>
        {w.distanceLabel && (
          <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
            {w.distanceLabel}
          </span>
        )}
      </div>

      {w.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {w.skills.slice(0, 4).map((s) => (
            <span key={s} className="rounded-lg bg-secondary px-2 py-1 text-[11px] font-medium">
              {skillLabel(s)}
            </span>
          ))}
        </div>
      )}

      {w.phoneNumber && (
        <a
          href={`tel:${w.phoneNumber}`}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary"
        >
          <Phone className="h-4 w-4" />
          {w.phoneNumber}
        </a>
      )}
    </div>
  );
}

export default function NearbyWorkers() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [radiusKm, setRadiusKm] = useState<number>(30);
  const [skill, setSkill] = useState('');
  const [region, setRegion] = useState('');
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [workers, setWorkers] = useState<EmployerWorker[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [mode, setMode] = useState<'nearby' | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runNearby = useCallback(
    async (lat: number, lng: number, pageArg = 1, radiusArg = radiusKm) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.employer.workersNearby({
          lat,
          lng,
          radius_km: radiusArg,
          skill: skill || undefined,
          region: region || undefined,
          page: pageArg,
          pageSize: PAGE_SIZE,
        });
        setWorkers(res.data);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
        setMode('nearby');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Qidiruvda xatolik');
      } finally {
        setLoading(false);
      }
    },
    [radiusKm, skill, region],
  );

  const runAll = useCallback(
    async (pageArg = 1) => {
      setLoading(true);
      setError('');
      try {
        const res = await api.employer.workers({
          search: search || undefined,
          skill: skill || undefined,
          region: region || undefined,
          nearDistrict: profile?.district || undefined,
          page: pageArg,
          pageSize: PAGE_SIZE,
        });
        setWorkers(res.data);
        setPage(res.page);
        setTotalPages(res.totalPages || 1);
        setMode('all');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Qidiruvda xatolik');
      } finally {
        setLoading(false);
      }
    },
    [search, skill, region, profile?.district],
  );

  const useMyLocation = useCallback(async () => {
    setError('');
    if (!isGeolocationAvailable()) {
      setError('Qurilma lokatsiyani qoʻllab-quvvatlamaydi. Hudud boʻyicha qidiring.');
      return;
    }
    setLoading(true);
    try {
      const pos = await getCurrentPosition();
      setCoords({ lat: pos.latitude, lng: pos.longitude });
      await runNearby(pos.latitude, pos.longitude, 1, radiusKm);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lokatsiya olinmadi');
      setLoading(false);
    }
  }, [radiusKm, runNearby]);

  const changeRadius = (r: number) => {
    setRadiusKm(r);
    if (coords) void runNearby(coords.lat, coords.lng, 1, r);
  };

  const goPage = (p: number) => {
    if (mode === 'nearby' && coords) void runNearby(coords.lat, coords.lng, p, radiusKm);
    else void runAll(p);
  };

  return (
    <DashboardLayout title="Yaqin atrofdagi ishchilar">
      <div className="space-y-5">
        <div className="rounded-2xl border border-border bg-card p-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Qidiruv (ism/familiya)</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && runAll(1)}
                  placeholder="Ism yoki familiya"
                  className="w-full min-h-[44px] rounded-xl border border-border pl-9 pr-3 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Kasb / koʻnikma</label>
              <select
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-border px-3 text-sm sm:w-48"
              >
                <option value="">Barchasi</option>
                {SKILLS.map((s) => (
                  <option key={s.id} value={s.id}>{t(`skills.${s.id}`, { defaultValue: s.name })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted-foreground">Hudud</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-border px-3 text-sm sm:w-48"
              >
                <option value="">Barchasi</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void runAll(1)}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Search className="h-4 w-4" /> Qidirish
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => void useMyLocation()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-sky-600 px-4 text-sm font-semibold text-white"
            >
              <Navigation className="h-4 w-4" /> Yaqinimdagi ishchilar
            </button>
            <span className="text-xs text-muted-foreground">Radius:</span>
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
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Yuklanmoqda…
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
            <MapPin className="h-8 w-8" />
            <p>Natija yoʻq. “Qidirish” yoki “Yaqinimdagi ishchilar” tugmasini bosing.</p>
          </div>
        ) : (
          <>
            {mode === 'nearby' && (
              <p className="text-xs text-muted-foreground">
                ~{radiusKm} km radiusdagi, lokatsiyani ulashgan ishchilar (taxminiy masofa).
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((w) => (
                <WorkerCardItem key={w.uid} w={w} />
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
                  Oldingi
                </button>
                <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => goPage(page + 1)}
                  className="min-h-[44px] rounded-xl bg-secondary px-4 text-sm font-semibold disabled:opacity-50"
                >
                  Keyingi
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
