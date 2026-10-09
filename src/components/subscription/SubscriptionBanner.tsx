import { Clock } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';

/** Shown only in the last week. The month itself stays fully open. */
export default function SubscriptionBanner() {
  const { status } = useSubscription();
  if (!status?.inWarningWindow || status.blocked) return null;

  const days = Math.max(1, status.daysRemaining);

  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl border border-[#c6a15b] bg-card px-4 py-3 text-sm font-semibold text-foreground">
      <Clock size={18} className="shrink-0 text-[#1a7c78]" />
      <span>
        Sun'iy intellekt va SMS to'lovini amalga oshiring. Obuna tugashiga {days} kun qoldi.
      </span>
    </div>
  );
}
