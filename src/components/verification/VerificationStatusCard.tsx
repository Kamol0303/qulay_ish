import { BadgeCheck, Clock, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Profile } from '../../types';

const STATUS_UI: Record<
  string,
  { label: string; className: string; icon: typeof BadgeCheck; desc: string }
> = {
  verified: {
    label: 'Tasdiqlangan',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    icon: BadgeCheck,
    desc: 'Qulay Ish tomonidan tasdiqlangan',
  },
  pending: {
    label: 'Tasdiqlash kutilmoqda',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    icon: Clock,
    desc: 'Arizangiz admin tekshiruvida',
  },
  under_review: {
    label: 'Tekshiruvda',
    className: 'border-blue-200 bg-blue-50 text-blue-800',
    icon: Shield,
    desc: 'Hujjatlar faol tekshirilmoqda',
  },
  rejected: {
    label: 'Rad etilgan',
    className: 'border-red-200 bg-red-50 text-red-800',
    icon: AlertTriangle,
    desc: 'Qayta ariza topshirish mumkin',
  },
  need_reupload: {
    label: 'Qayta yuklash kerak',
    className: 'border-orange-200 bg-orange-50 text-orange-800',
    icon: RefreshCw,
    desc: 'Qo\'shimcha yoki yangi hujjat yuklang',
  },
  none: {
    label: 'Tasdiqlanmagan',
    className: 'border-border bg-muted/40 text-foreground',
    icon: Shield,
    desc: 'Shaxsni tasdiqlashni boshlang',
  },
};

export function VerificationStatusCard({
  profile,
  showAction = true,
}: {
  profile: Profile;
  showAction?: boolean;
}) {
  const key = profile.isVerified
    ? 'verified'
    : profile.verificationStatus || 'none';
  const ui = STATUS_UI[key] || STATUS_UI.none;
  const Icon = ui.icon;

  return (
    <div className={`rounded-2xl border p-4 ${ui.className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-xl bg-white/70 p-2">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold">{ui.label}</p>
            <p className="mt-0.5 text-sm opacity-80">{ui.desc}</p>
            {key === 'verified' && (
              <p className="mt-1 text-xs opacity-70">
                Qulay Ish tomonidan tasdiqlangan
                {profile.updatedAt
                  ? ` · ${new Date(profile.updatedAt).toLocaleDateString('uz-UZ')}`
                  : ''}
              </p>
            )}
          </div>
        </div>
        {showAction && key !== 'verified' && key !== 'pending' && key !== 'under_review' && (
          <Link
            to="/verification"
            className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold hover:bg-white"
          >
            Tasdiqlash
          </Link>
        )}
        {showAction && (key === 'pending' || key === 'under_review') && (
          <Link
            to="/verification"
            className="shrink-0 rounded-xl bg-white/80 px-3 py-1.5 text-xs font-bold hover:bg-white"
          >
            Holat
          </Link>
        )}
      </div>
      <p className="mt-3 text-[11px] opacity-60">
        Pasport, ID va selfi hujjatlari faqat Super Admin panelida ko‘rinadi.
      </p>
    </div>
  );
}
