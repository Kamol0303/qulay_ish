import { AlertTriangle, Clock } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext';

/** Non-blocking warning shown to Super Admin as the subscription nears/past expiry. */
export default function SubscriptionBanner() {
  const { status } = useSubscription();
  if (!status) return null;

  if (status.status === 'grace') {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-semibold text-orange-800">
        <AlertTriangle size={18} className="shrink-0" />
        <span>
          Obuna muddati tugadi. Imtiyozli davr: yana {status.graceDaysRemaining} kun.
          Iltimos, to'lovni amalga oshiring — aks holda ba'zi sahifalar bloklanadi.
        </span>
      </div>
    );
  }

  if (status.inWarningWindow) {
    return (
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm font-semibold text-yellow-800">
        <Clock size={18} className="shrink-0" />
        <span>
          Obuna muddati {status.daysRemaining} kundan so'ng tugaydi. Uzluksiz
          foydalanish uchun oldindan to'lovni amalga oshiring.
        </span>
      </div>
    );
  }

  return null;
}
