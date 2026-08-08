import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, FileText, Bell, LogOut, BadgeCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import MobileCard from '../components/Card';
import { mediaUrl, avatarFallback } from '../../lib/mediaUrl';
import { hapticMedium } from '../haptics';

export default function ProfileMobile() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  if (!profile) {
    return (
      <div className="px-4 py-16 text-center space-y-4">
        <p className="text-muted-foreground">Avval tizimga kiring</p>
        <Link
          to="/auth"
          className="inline-flex min-h-[44px] items-center px-6 rounded-2xl bg-primary text-primary-foreground font-bold"
        >
          Kirish
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-5 space-y-4">
      <MobileCard className="flex items-center gap-4">
        <img
          src={mediaUrl(profile.photoUrl) || avatarFallback(profile.fullName)}
          alt=""
          className="w-16 h-16 rounded-2xl object-cover bg-muted"
        />
        <div className="min-w-0">
          <h1 className="font-black text-lg truncate">{profile.fullName}</h1>
          <p className="text-xs text-muted-foreground capitalize">{profile.role}</p>
          <p className="text-xs text-muted-foreground">{profile.phoneNumber || profile.email}</p>
        </div>
      </MobileCard>

      <div className="space-y-2">
        <LinkRow to="/verification" icon={BadgeCheck} label="Shaxsni tasdiqlash" />
        <LinkRow to={`/resume/${profile.uid}`} icon={FileText} label="Resume" />
        <LinkRow to="/notifications" icon={Bell} label="Bildirishnomalar" />
        <LinkRow to="/saved-jobs" icon={ShieldCheck} label="Saqlangan ishlar" />
      </div>

      <button
        type="button"
        className="w-full min-h-[48px] rounded-2xl border border-destructive/30 text-destructive font-bold inline-flex items-center justify-center gap-2"
        onClick={async () => {
          void hapticMedium();
          await signOut();
          navigate('/auth');
        }}
      >
        <LogOut size={18} /> Chiqish
      </button>
    </div>
  );
}

function LinkRow({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="min-h-[48px] flex items-center gap-3 rounded-2xl border border-border bg-card px-4 font-semibold text-sm"
    >
      <Icon size={18} />
      {label}
      <span className="ml-auto text-primary">→</span>
    </Link>
  );
}
