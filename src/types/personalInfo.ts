/** Confidential worker personal information — worker self + super_admin only */
export type Gender = 'male' | 'female' | 'other' | '';

export type MaritalStatus =
  | 'single'
  | 'married'
  | 'divorced'
  | 'widowed'
  | 'other'
  | '';

export type ChildrenStatus = 'none' | 'has_children' | '';

export interface WorkerPersonalInfo {
  fullName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  age?: number;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  childrenStatus?: ChildrenStatus;
  childrenCount?: number;
  profession?: string;
  specialty?: string;
  educationLevel?: string;
  nationality?: string;
  citizenship?: string;
  currentAddress?: string;
  permanentAddress?: string;
  phone?: string;
  additionalPhone?: string;
  email?: string;
  about?: string;
  notes?: string;
  /** Audit — last editor */
  updatedAt?: string;
  updatedBy?: string;
  updatedByRole?: string;
}

export const PERSONAL_INFO_REQUIRED: Array<keyof WorkerPersonalInfo> = [
  'fullName',
  'dateOfBirth',
  'gender',
  'maritalStatus',
  'childrenStatus',
  'profession',
  'specialty',
  'educationLevel',
  'citizenship',
  'currentAddress',
  'phone',
  'email',
];

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Erkak' },
  { value: 'female', label: 'Ayol' },
  { value: 'other', label: 'Boshqa' },
];

export const MARITAL_OPTIONS: { value: MaritalStatus; label: string }[] = [
  { value: 'single', label: "Bo'ydoq / Turmush qurmagan" },
  { value: 'married', label: 'Turmush qurgan' },
  { value: 'divorced', label: 'Ajrashgan' },
  { value: 'widowed', label: 'Beva' },
  { value: 'other', label: 'Boshqa' },
];

export const CHILDREN_OPTIONS: { value: ChildrenStatus; label: string }[] = [
  { value: 'none', label: "Farzandi yo'q" },
  { value: 'has_children', label: 'Farzandlari bor' },
];

export function calcAgeFromDob(dateOfBirth?: string): number | undefined {
  if (!dateOfBirth) return undefined;
  const d = new Date(dateOfBirth);
  if (Number.isNaN(d.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  if (age < 0 || age > 120) return undefined;
  return age;
}
