import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, Building2, Loader2, MapPin, Search, UserRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { useIsMobileUi } from '../hooks/useIsMobileUi';
import { api } from '../lib/api';
import { avatarFallback, mediaUrl } from '../lib/mediaUrl';
import { districtProximityKey } from '../constants/districts';
import type { Profile } from '../types';

function DirectoryContent() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [people, setPeople] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const targetRole = profile?.role === 'employer' ? 'worker' : 'employer';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void api.users
      .list({ role: targetRole })
      .then((rows) => {
        if (cancelled) return;
        setPeople(
          rows
            .filter((person) => !person.isBlocked)
            .sort(
              (a, b) =>
                districtProximityKey(profile?.district, a.district) -
                districtProximityKey(profile?.district, b.district),
            ),
        );
      })
      .catch(() => {
        if (!cancelled) setPeople([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profile?.district, targetRole]);

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return people;
    return people.filter((person) =>
      [person.fullName, person.companyName, person.bio, person.district]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query)),
    );
  }, [people, search]);

  const title =
    targetRole === 'worker' ? t('directory.workers_title') : t('directory.employers_title');

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 py-2 sm:px-4 sm:py-6">
      <div>
        <h1 className="text-2xl font-black text-foreground">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {targetRole === 'worker'
            ? t('directory.workers_desc')
            : t('directory.employers_desc')}
        </p>
      </div>

      <label className="relative block">
        <Search
          size={19}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('directory.search')}
          className="w-full rounded-2xl border border-border bg-card py-3.5 pl-11 pr-4 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        />
      </label>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-border bg-card p-10 text-center text-muted-foreground">
          {t('directory.empty')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {filtered.map((person) => (
            <Link
              key={person.uid}
              to={`/profile/${person.uid}`}
              className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <img
                src={mediaUrl(person.photoUrl) || avatarFallback(person.fullName)}
                alt={person.fullName}
                className="h-16 w-16 shrink-0 rounded-2xl bg-secondary object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate font-black text-foreground">
                    {person.companyName || person.fullName}
                  </h2>
                  {person.isVerified && <BadgeCheck size={17} className="shrink-0 text-primary" />}
                </div>
                {person.companyName && (
                  <p className="truncate text-sm text-muted-foreground">{person.fullName}</p>
                )}
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={13} />
                  {person.district
                    ? t(`districts.${person.district}`, { defaultValue: person.district })
                    : t('directory.location_unknown')}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                  {targetRole === 'worker' ? <UserRound size={13} /> : <Building2 size={13} />}
                  {targetRole === 'worker' ? t('directory.worker') : t('directory.employer')}
                </p>
                {targetRole === 'worker' && (
                  <span
                    className={`ml-1 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                      person.availability === 'busy'
                        ? 'bg-amber-500/10 text-amber-600'
                        : 'bg-emerald-500/10 text-emerald-600'
                    }`}
                  >
                    {person.availability === 'busy'
                      ? t('directory.busy')
                      : t('directory.available')}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PeopleDirectoryPage() {
  const mobile = useIsMobileUi();
  if (mobile) return <DirectoryContent />;
  return (
    <DashboardLayout>
      <DirectoryContent />
    </DashboardLayout>
  );
}
