import type { Profile } from '../types';

export interface CompletionItem {
  id: string;
  label: string;
  done: boolean;
}

export function getWorkerCompletion(profile: Profile): { percent: number; items: CompletionItem[] } {
  const items: CompletionItem[] = [
    { id: 'personal', label: 'Shaxsiy ma\'lumot', done: Boolean(profile.fullName && profile.phoneNumber && profile.region) },
    { id: 'photo', label: 'Profil rasmi', done: Boolean(profile.photoUrl) },
    { id: 'summary', label: 'Professional summary', done: Boolean(profile.professionalSummary || profile.bio) },
    { id: 'skills', label: 'Ko\'nikmalar', done: (profile.skills?.length ?? 0) >= 2 },
    { id: 'education', label: 'Ta\'lim', done: (profile.education?.length ?? 0) > 0 },
    { id: 'experience', label: 'Tajriba', done: (profile.experience?.length ?? 0) > 0 },
    { id: 'certificates', label: 'Sertifikatlar', done: (profile.certificates?.length ?? 0) > 0 },
    { id: 'portfolio', label: 'Portfolio', done: (profile.portfolio?.length ?? 0) > 0 },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}

export function getEmployerCompletion(profile: Profile): { percent: number; items: CompletionItem[] } {
  const items: CompletionItem[] = [
    { id: 'company', label: 'Kompaniya nomi', done: Boolean(profile.companyName || profile.fullName) },
    { id: 'logo', label: 'Logo', done: Boolean(profile.photoUrl) },
    { id: 'cover', label: 'Cover', done: Boolean(profile.coverUrl) },
    { id: 'about', label: 'Tavsif', done: Boolean(profile.bio || profile.professionalSummary) },
    { id: 'contact', label: 'Aloqa', done: Boolean(profile.phoneNumber || profile.email || profile.telegram) },
    { id: 'address', label: 'Manzil', done: Boolean(profile.officeAddress || profile.region) },
    { id: 'legal', label: 'INN / ro\'yxat', done: Boolean(profile.tin || profile.registrationNumber) },
    { id: 'industry', label: 'Soha', done: Boolean(profile.industry || profile.businessType) },
  ];
  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
