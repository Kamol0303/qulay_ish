import { useState } from 'react';
import { MapPin, ShieldCheck, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import { getCurrentPosition, isGeolocationAvailable } from '../../lib/geolocation';
import { ProfileCard } from './ProfileCard';

/**
 * Opt-in location sharing for workers. Consent-first: nothing is sent until the
 * worker explicitly enables it, and it can be turned off any time. Employers only
 * ever see an approximate distance — never the exact coordinates saved here.
 */
export function LocationSharingCard({
  userId,
  enabled,
  updatedAt,
  role = 'worker',
}: {
  userId: string;
  enabled?: boolean;
  updatedAt?: string | Date;
  role?: 'worker' | 'employer';
}) {
  const isEmployer = role === 'employer';
  const copy = isEmployer
    ? {
        description:
          'Ixtiyoriy. Yoqilsa, yaqin atrofdagi ishchilar sizning ish e\u2019lonlaringizni masofa boʻyicha topa oladi.',
        privacy:
          'Ishchilarga aniq joylashuvingiz emas, faqat taxminiy masofa (masalan \u201c~12 km\u201d) koʻrsatiladi. Istalgan vaqtda oʻchirishingiz mumkin.',
        enabledMsg: 'Lokatsiya yoqildi. Yaqin atrofdagi ishchilar sizning e\u2019lonlaringizni topa oladi.',
      }
    : {
        description:
          'Ixtiyoriy. Yoqilsa, yaqin atrofdagi buyurtmachilar sizni masofa boʻyicha topa oladi.',
        privacy:
          'Buyurtmachilarga aniq joylashuvingiz emas, faqat taxminiy masofa (masalan \u201c~12 km\u201d) koʻrsatiladi. Istalgan vaqtda oʻchirishingiz mumkin.',
        enabledMsg: 'Lokatsiya yoqildi. Yaqin atrofdagi buyurtmachilar sizni topa oladi.',
      };
  const [sharing, setSharing] = useState(Boolean(enabled));
  const [lastUpdated, setLastUpdated] = useState<string | Date | undefined>(updatedAt);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const enable = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (!isGeolocationAvailable()) {
        throw new Error('Qurilma lokatsiyani qoʻllab-quvvatlamaydi');
      }
      const pos = await getCurrentPosition();
      const res = await api.users.updateLocation(userId, {
        latitude: pos.latitude,
        longitude: pos.longitude,
        enabled: true,
      });
      setSharing(res.locationSharingEnabled);
      setLastUpdated(res.locationUpdatedAt ?? new Date().toISOString());
      setSuccess(copy.enabledMsg);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lokatsiyani yoqishda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const pos = await getCurrentPosition();
      const res = await api.users.updateLocation(userId, {
        latitude: pos.latitude,
        longitude: pos.longitude,
        enabled: true,
      });
      setSharing(res.locationSharingEnabled);
      setLastUpdated(res.locationUpdatedAt ?? new Date().toISOString());
      setSuccess('Lokatsiya yangilandi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Yangilashda xatolik');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.users.clearLocation(userId);
      setSharing(false);
      setLastUpdated(undefined);
      setSuccess('Lokatsiya oʻchirildi va saqlangan koordinatalar tozalandi.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Oʻchirishda xatolik');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProfileCard
      title="Lokatsiya ulashish"
      description={copy.description}
    >
      <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{copy.privacy}</p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <MapPin className={`h-4 w-4 ${sharing ? 'text-emerald-600' : 'text-slate-400'}`} />
        <span className="font-semibold">
          {sharing ? 'Lokatsiya yoqilgan' : 'Lokatsiya oʻchirilgan'}
        </span>
      </div>
      {sharing && lastUpdated && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Oxirgi yangilanish: {new Date(lastUpdated).toLocaleString('uz-UZ')}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {!sharing ? (
          <button
            type="button"
            onClick={() => void enable()}
            disabled={busy}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            Lokatsiyani yoqish
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              Lokatsiyani yangilash
            </button>
            <button
              type="button"
              onClick={() => void disable()}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700 disabled:opacity-60"
            >
              Lokatsiyani oʻchirish
            </button>
          </>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
    </ProfileCard>
  );
}
