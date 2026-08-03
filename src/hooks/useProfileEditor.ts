import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type {
  CertificateRecord,
  EducationRecord,
  ExperienceRecord,
  PortfolioItem,
  Profile,
} from '../types';

function withIds<T extends { id?: string }>(rows: T[] | undefined): Array<T & { id: string }> {
  return (rows || []).map((row, index) => ({
    ...row,
    id: row.id || `row-${index}-${Date.now()}`,
  }));
}

export function useProfileEditor(profile: Profile | null, refreshProfile: () => Promise<void>) {
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!profile) return;
    setDraft({
      ...profile,
      education: withIds(profile.education) as EducationRecord[],
      experience: withIds(profile.experience) as ExperienceRecord[],
      certificates: withIds(profile.certificates) as CertificateRecord[],
      portfolio: withIds(profile.portfolio) as PortfolioItem[],
      languages: profile.languages || [],
      skills: profile.skills || [],
      companyGallery: withIds(profile.companyGallery) as PortfolioItem[],
      companyDocuments: withIds(profile.companyDocuments),
      recruiterContacts: withIds(profile.recruiterContacts),
    });
  }, [profile]);

  const patch = useCallback((partial: Partial<Profile>) => {
    setDraft((prev) => (prev ? { ...prev, ...partial } : prev));
    setSuccess('');
    setError('');
  }, []);

  const save = useCallback(async () => {
    if (!draft?.uid) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const {
        uid: _uid,
        passwordHash: _ph,
        createdAt: _c,
        updatedAt: _u,
        lastActive: _l,
        rating: _r,
        reviewCount: _rc,
        completedJobs: _cj,
        violationCount: _v,
        riskScore: _rs,
        trustScore: _ts,
        behaviorFlags: _bf,
        isBlocked: _ib,
        blockReason: _br,
        isVerified: _iv,
        verificationStatus: _vs,
        ...payload
      } = draft;

      await api.users.update(draft.uid, payload);
      await refreshProfile();
      setSuccess('Profil saqlandi');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Saqlashda xatolik');
    } finally {
      setSaving(false);
    }
  }, [draft, refreshProfile]);

  return { draft, patch, save, saving, error, success, setSuccess, setError };
}
