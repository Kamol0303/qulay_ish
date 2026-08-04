import { BadRequestException } from '@nestjs/common';

export type CoreIndicatorsPayload = {
  familyIncome?: string;
  motherSocialStatus?: string;
  educationResults?: string;
  attendance?: string;
  healthStatus?: string;
  psychologicalState?: string;
  disabilityStatus?: string;
  earlyMarriageRisk?: string;
  violenceRisk?: string;
  digitalLiteracy?: string;
  riskAssessment?: string;
  updatedAt?: string;
  updatedBy?: string;
  updatedByRole?: string;
};

const RISK_VALUES = new Set(['', 'none', 'low', 'medium', 'high', 'critical', 'unknown']);

function trimStr(v: unknown, max: number): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.slice(0, max);
}

export function sanitizeCoreIndicators(
  raw: unknown,
  audit: { userId: string; role: string },
): CoreIndicatorsPayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BadRequestException('Индикаторлар нотўғри форматда');
  }
  const body = raw as Record<string, unknown>;
  const out: CoreIndicatorsPayload = {
    familyIncome: trimStr(body.familyIncome, 200),
    motherSocialStatus: trimStr(body.motherSocialStatus, 200),
    educationResults: trimStr(body.educationResults, 200),
    attendance: trimStr(body.attendance, 200),
    healthStatus: trimStr(body.healthStatus, 200),
    psychologicalState: trimStr(body.psychologicalState, 200),
    disabilityStatus: trimStr(body.disabilityStatus, 200),
    digitalLiteracy: trimStr(body.digitalLiteracy, 200),
    riskAssessment: trimStr(body.riskAssessment, 1000),
  };

  const early = trimStr(body.earlyMarriageRisk, 40) || '';
  const violence = trimStr(body.violenceRisk, 40) || '';
  if (!RISK_VALUES.has(early) || !RISK_VALUES.has(violence)) {
    throw new BadRequestException('Хавф даражаси нотўғри');
  }
  out.earlyMarriageRisk = early || undefined;
  out.violenceRisk = violence || undefined;

  out.updatedAt = new Date().toISOString();
  out.updatedBy = audit.userId;
  out.updatedByRole = audit.role;
  return out;
}
