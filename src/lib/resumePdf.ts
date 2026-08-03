import { jsPDF } from 'jspdf';
import type { Profile, ResumeTemplateId } from '../types';
import { buildResumeModel } from './resumeModel';
import { mediaUrl } from './mediaUrl';

const TEMPLATES: Record<ResumeTemplateId, { accent: [number, number, number]; title: string }> = {
  minimal: { accent: [30, 41, 59], title: 'Minimal' },
  professional: { accent: [29, 78, 216], title: 'Professional' },
  corporate: { accent: [15, 23, 42], title: 'Corporate' },
  government: { accent: [6, 95, 70], title: 'Government' },
  modern: { accent: [14, 116, 144], title: 'Modern' },
  creative: { accent: [180, 83, 9], title: 'Creative' },
};

export const RESUME_TEMPLATES = Object.entries(TEMPLATES).map(([id, meta]) => ({
  id: id as ResumeTemplateId,
  name: meta.title,
}));

const PAGE_W = 210;
const PAGE_H = 297;
const LEFT_W = 68;
const RIGHT_X = 74;
const RIGHT_W = 124;
const MARGIN_BOTTOM = 16;

function safe(text?: string | null): string {
  return (text || '')
    .replace(/[^\x00-\x7F\u0400-\u04FF\u0100-\u024F\u2013\u2014\u2018\u2019\u201c\u201d\s.,;:!?\-_()@+/★•%]/g, '')
    .trim();
}

async function loadImageDataUrl(url?: string): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawSidebarBackground(doc: jsPDF, rgb: [number, number, number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
  doc.rect(0, 0, LEFT_W, PAGE_H, 'F');
}

export async function downloadResumePdf(profile: Profile, templateId?: ResumeTemplateId): Promise<void> {
  const tplId = (templateId || profile.resumeTemplate || 'professional') as ResumeTemplateId;
  const template = TEMPLATES[tplId] || TEMPLATES.professional;
  const model = buildResumeModel(profile);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const rgb = template.accent;

  const photoData = await loadImageDataUrl(model.photoUrl);
  const qrData = await loadImageDataUrl(
    `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(model.verifyUrl)}`,
  );

  // First page sidebar + photo
  drawSidebarBackground(doc, rgb);

  let leftY = 14;
  if (photoData) {
    try {
      const fmt = photoData.includes('image/png') ? 'PNG' : 'JPEG';
      doc.addImage(photoData, fmt, LEFT_W / 2 - 15, 13, 30, 30, undefined, 'FAST');
      leftY = 48;
    } catch {
      doc.setFillColor(255, 255, 255);
      doc.circle(LEFT_W / 2, 28, 15, 'F');
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.setFontSize(14);
      doc.text(model.initials, LEFT_W / 2, 31, { align: 'center' });
      leftY = 48;
    }
  } else {
    doc.setFillColor(255, 255, 255);
    doc.circle(LEFT_W / 2, 28, 15, 'F');
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setFontSize(14);
    doc.text(model.initials, LEFT_W / 2, 31, { align: 'center' });
    leftY = 48;
  }

  const leftSection = (title: string) => {
    if (leftY > PAGE_H - 30) return false;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(title.toUpperCase(), 8, leftY);
    leftY += 5;
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.2);
    doc.line(8, leftY, LEFT_W - 8, leftY);
    leftY += 5;
    doc.setFont('helvetica', 'normal');
    return true;
  };

  const leftText = (text: string, size = 8) => {
    if (leftY > PAGE_H - 12) return;
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(safe(text), LEFT_W - 16);
    doc.text(lines, 8, leftY);
    leftY += lines.length * 3.6 + 2;
  };

  leftSection('Contact');
  if (model.phone) leftText(model.phone);
  if (model.email) leftText(model.email);
  if (model.telegram) leftText(model.telegram);
  if (model.address) leftText(model.address);
  if (model.availability) leftText(`Status: ${model.availability}`);

  if (model.skills.length) {
    leftSection('Skills');
    leftText(model.skills.join('  ·  '), 7.5);
  }

  if (model.languages.length) {
    leftSection('Languages');
    for (const lang of model.languages) {
      if (leftY > PAGE_H - 18) break;
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8);
      doc.text(`${safe(lang.name)}  ${lang.level}%`, 8, leftY);
      leftY += 3;
      // track
      doc.setFillColor(180, 200, 230);
      doc.rect(8, leftY, LEFT_W - 16, 1.6, 'F');
      // value
      doc.setFillColor(255, 255, 255);
      const barW = ((LEFT_W - 16) * lang.level) / 100;
      doc.rect(8, leftY, Math.max(1, barW), 1.6, 'F');
      leftY += 5;
    }
  }

  if (model.softSkills.length) {
    leftSection('Soft Skills');
    leftText(model.softSkills.join('  ·  '), 7.5);
  }

  if (qrData && leftY < PAGE_H - 45) {
    leftSection('QR Verify');
    try {
      doc.addImage(qrData, 'PNG', 16, leftY, 28, 28);
      leftY += 32;
      leftText(model.verifyUrl, 6);
    } catch {
      leftText(model.verifyUrl, 6);
    }
  }

  // RIGHT COLUMN
  let y = 16;
  let page = 1;

  const ensureSpace = (need: number) => {
    if (y + need <= PAGE_H - MARGIN_BOTTOM) return;
    doc.addPage();
    page += 1;
    drawSidebarBackground(doc, rgb);
    // continuation label on sidebar
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('Qulay Ish Resume', 8, 16);
    doc.text(`Page ${page}`, 8, 22);
    y = 16;
  };

  const rightSection = (title: string) => {
    ensureSpace(12);
    doc.setTextColor(rgb[0], rgb[1], rgb[2]);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(title.toUpperCase(), RIGHT_X, y);
    y += 2;
    doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
    doc.setLineWidth(0.35);
    doc.line(RIGHT_X, y, RIGHT_X + RIGHT_W, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
  };

  const rightPara = (text: string, size = 9) => {
    const lines = doc.splitTextToSize(safe(text), RIGHT_W);
    ensureSpace(lines.length * 4.2 + 2);
    doc.setFontSize(size);
    doc.setTextColor(51, 65, 85);
    doc.text(lines, RIGHT_X, y);
    y += lines.length * 4.2 + 2;
  };

  // Header
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(safe(model.fullName), RIGHT_X, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
  doc.text(safe(model.title), RIGHT_X, y);
  y += 6;
  if (model.isVerified) {
    doc.setFontSize(8);
    doc.setTextColor(6, 95, 70);
    doc.text('✓ Verified Qulay Ish Profile', RIGHT_X, y);
    y += 6;
  }
  y += 2;

  if (model.summary) {
    rightSection('About Me');
    rightPara(model.summary, 9);
  }

  if (model.experience.length) {
    rightSection('Work Experience');
    for (const exp of model.experience) {
      ensureSpace(18);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(safe(exp.position || 'Role'), RIGHT_X, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const dates = `${exp.startYear || ''} – ${exp.current ? 'Present' : exp.endYear || ''}`;
      doc.text(safe(dates), RIGHT_X + RIGHT_W, y, { align: 'right' });
      y += 4.5;
      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.setFontSize(9);
      doc.text(safe(exp.company || ''), RIGHT_X, y);
      y += 4.5;
      if (exp.details) rightPara(exp.details, 8.5);
      if (exp.achievements) rightPara(`★ ${exp.achievements}`, 8.5);
      y += 2;
    }
  }

  if (model.education.length) {
    rightSection('Education');
    for (const edu of model.education) {
      ensureSpace(14);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(safe(edu.degree || 'Degree'), RIGHT_X, y);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(safe(`${edu.startYear || ''} – ${edu.endYear || ''}`), RIGHT_X + RIGHT_W, y, { align: 'right' });
      y += 4.5;
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text(safe(edu.institution || ''), RIGHT_X, y);
      y += 4.5;
      if (edu.notes) rightPara(edu.notes, 8.5);
      y += 1;
    }
  }

  if (model.certificates.length) {
    rightSection('Certificates');
    for (const cert of model.certificates) {
      ensureSpace(10);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(`• ${safe(cert.title)}`, RIGHT_X, y);
      y += 4;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.setFontSize(8);
      const meta = [cert.issuer, cert.issuedAt, cert.fileName || (cert.fileUrl ? 'file attached' : '')]
        .filter(Boolean)
        .map(safe)
        .join(' · ');
      if (meta) {
        const lines = doc.splitTextToSize(meta, RIGHT_W - 3);
        doc.text(lines, RIGHT_X + 3, y);
        y += lines.length * 3.5 + 2;
      }
    }
  }

  if (model.portfolio.length) {
    rightSection('Portfolio');
    for (const item of model.portfolio) {
      ensureSpace(9);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${safe(item.title)} [${safe(item.kind)}]`, RIGHT_X, y);
      y += 4;
      if (item.description) rightPara(item.description, 8);
      if (item.fileUrl) {
        doc.setTextColor(29, 78, 216);
        doc.setFontSize(7.5);
        const urlLines = doc.splitTextToSize(safe(mediaUrl(item.fileUrl) || item.fileUrl), RIGHT_W);
        ensureSpace(urlLines.length * 3.2 + 1);
        doc.text(urlLines, RIGHT_X + 2, y);
        y += urlLines.length * 3.2 + 2;
      }
    }
  }

  if (model.uploadedFiles.length) {
    rightSection('Uploaded Files');
    for (const file of model.uploadedFiles) {
      ensureSpace(8);
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(
        `• ${safe(file.title)} (${file.kind.toUpperCase()}${file.source ? `, ${file.source}` : ''})`,
        RIGHT_X,
        y,
      );
      y += 4.2;
    }
  }

  // Verification card
  ensureSpace(28);
  rightSection('Verification');
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(RIGHT_X, y, RIGHT_W, 24, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(model.isVerified ? '✓ Verified on Qulay Ish' : 'Qulay Ish Profile', RIGHT_X + 3, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(`Profile ID: ${safe(model.profileId)}`, RIGHT_X + 3, y + 11);
  if (model.verificationDate) {
    doc.text(`Updated: ${safe(model.verificationDate)}`, RIGHT_X + 3, y + 15);
  }
  const verifyLines = doc.splitTextToSize(safe(model.verifyUrl), RIGHT_W - 28);
  doc.text(verifyLines, RIGHT_X + 3, y + 19);
  if (qrData) {
    try {
      doc.addImage(qrData, 'PNG', RIGHT_X + RIGHT_W - 22, y + 3, 18, 18);
    } catch {
      /* ignore */
    }
  }

  doc.save(`${(model.fullName || 'resume').replace(/\s+/g, '_')}_QulayIsh_Resume.pdf`);
}
