type AnyUser = Record<string, any>;

function len(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

/** Server-side mirror of the frontend worker/employer completion heuristics. */
export function profileCompletionPercent(user: AnyUser): number {
  if (user.role === 'employer') {
    const items = [
      Boolean(user.companyName || user.fullName),
      Boolean(user.photoUrl),
      Boolean(user.coverUrl),
      Boolean(user.bio || user.professionalSummary),
      Boolean(user.phoneNumber || user.email || user.telegram),
      Boolean(user.officeAddress || user.region),
      Boolean(user.tin || user.registrationNumber),
      Boolean(user.industry || user.businessType),
    ];
    const done = items.filter(Boolean).length;
    return Math.round((done / items.length) * 100);
  }

  // worker (default)
  const items = [
    Boolean((user.firstName || user.fullName) && user.phoneNumber && user.region),
    Boolean(user.photoUrl),
    Boolean(user.professionalSummary || user.bio),
    len(user.skills) >= 2,
    len(user.education) > 0,
    len(user.experience) > 0,
    len(user.certificates) > 0,
    len(user.portfolio) > 0,
  ];
  const done = items.filter(Boolean).length;
  return Math.round((done / items.length) * 100);
}
