import { jsPDF } from 'jspdf';
import type { Profile, ResumeTemplateId } from '../types';
import { mediaUrl } from './mediaUrl';

const TEMPLATES: Record<ResumeTemplateId, { accent: [number, number, number]; title: string }> = {
  minimal: { accent: [30, 41, 59], title: 'Minimal' },
  professional: { accent: [30, 64, 175], title: 'Professional' },
  corporate: { accent: [15, 23, 42], title: 'Corporate' },
  government: { accent: [22, 101, 52], title: 'Government' },
  modern: { accent: [8, 145, 178], title: 'Modern' },
  creative: { accent: [180, 83, 9], title: 'Creative' },
};

export const RESUME_TEMPLATES = Object.entries(TEMPLATES).map(([id, meta]) => ({
  id: id as ResumeTemplateId,
  name: meta.title,
}));

function safe(text?: string | null): string {
  return (text || '').replace(/[^\x00-\x7F\u0400-\u04FF\u0100-\u024F\s.,;:!?\-_()@+/]/g, '');
}

export async function downloadResumePdf(profile: Profile, templateId?: ResumeTemplateId): Promise<void> {
  const template = TEMPLATES[(templateId || profile.resumeTemplate || 'professional') as ResumeTemplateId] || TEMPLATES.professional;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const [r, g, b] = template.accent;

  doc.setFillColor(r, g, b);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.text(safe(profile.fullName) || 'Resume', 14, 16);
  doc.setFontSize(10);
  doc.text(
    [profile.role === 'employer' ? profile.companyName : profile.experienceLevel, profile.region, profile.district]
      .filter(Boolean)
      .map(safe)
      .join(' · ') || 'Qulay Ish',
    14,
    24,
  );
  doc.text(
    [profile.phoneNumber, profile.email, profile.telegram].filter(Boolean).map(safe).join('  |  '),
    14,
    30,
  );

  let y = 46;
  doc.setTextColor(30, 41, 59);

  const section = (title: string) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(12);
    doc.setTextColor(r, g, b);
    doc.text(title, 14, y);
    y += 2;
    doc.setDrawColor(r, g, b);
    doc.line(14, y, 196, y);
    y += 7;
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(10);
  };

  const para = (text: string) => {
    const lines = doc.splitTextToSize(safe(text), 182);
    doc.text(lines, 14, y);
    y += lines.length * 5 + 3;
  };

  const summary = profile.professionalSummary || profile.bio;
  if (summary) {
    section('SUMMARY');
    para(summary);
  }

  if (profile.skills?.length) {
    section('SKILLS');
    para(profile.skills.join(', '));
  }

  if (profile.languages?.length) {
    section('LANGUAGES');
    para(profile.languages.join(', '));
  }

  if (profile.experience?.length) {
    section('EXPERIENCE');
    for (const exp of profile.experience) {
      doc.setFontSize(11);
      doc.text(safe(`${exp.position} — ${exp.company}`), 14, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(safe(`${exp.startYear || ''} – ${exp.current ? 'hozir' : exp.endYear || ''}`), 14, y);
      y += 5;
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(10);
      if (exp.details) para(exp.details);
      if (exp.achievements) para(exp.achievements);
      y += 2;
    }
  }

  if (profile.education?.length) {
    section('EDUCATION');
    for (const edu of profile.education) {
      doc.setFontSize(11);
      doc.text(safe(`${edu.degree} — ${edu.institution}`), 14, y);
      y += 5;
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(safe(`${edu.startYear || ''} – ${edu.endYear || ''}`), 14, y);
      y += 5;
      doc.setTextColor(30, 41, 59);
      if (edu.notes) {
        doc.setFontSize(10);
        para(edu.notes);
      }
      y += 2;
    }
  }

  if (profile.certificates?.length) {
    section('CERTIFICATES');
    for (const cert of profile.certificates) {
      para(`${cert.title}${cert.issuer ? ` — ${cert.issuer}` : ''}`);
    }
  }

  // QR verification stub (profile URL text)
  if (y < 260) {
    section('VERIFICATION');
    para(`Qulay Ish profile: /worker/${profile.uid}`);
    if (mediaUrl(profile.photoUrl)) {
      para('Photo attached in online profile.');
    }
  }

  doc.save(`${(profile.fullName || 'resume').replace(/\s+/g, '_')}_resume.pdf`);
}
