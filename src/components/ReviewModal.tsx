import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import { ApiError } from '../lib/api/client';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  applicationId: string;
  workerName?: string;
  jobTitle?: string;
  onSubmitted?: () => void;
}

export default function ReviewModal({
  isOpen,
  onClose,
  applicationId,
  workerName,
  jobTitle,
  onSubmitted,
}: ReviewModalProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setRating(5);
      setHovered(0);
      setComment('');
      setError(null);
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen, applicationId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) {
      setError(t('reviews.pick_rating', { defaultValue: 'Iltimos, yulduz tanlang' }));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.reviews.create({ applicationId, rating, comment: comment.trim() || undefined });
      setSuccess(true);
      onSubmitted?.();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : t('common.error_occurred', { defaultValue: 'Xatolik yuz berdi' }),
      );
    } finally {
      setLoading(false);
    }
  };

  const active = hovered || rating;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                    {t('reviews.title', { defaultValue: 'Ishchini baholang' })}
                  </h2>
                  <p className="text-gray-500 text-sm mt-1">
                    {workerName || t('common.unknown_worker', { defaultValue: 'Ishchi' })}
                    {jobTitle ? ` — ${jobTitle}` : ''}
                  </p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X size={24} className="text-gray-400" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm">
                  <AlertCircle size={18} />
                  <p className="font-medium">{error}</p>
                </div>
              )}

              {success ? (
                <div className="py-10 text-center">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                    <CheckCircle size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {t('reviews.thanks', { defaultValue: 'Rahmat!' })}
                  </h3>
                  <p className="text-gray-500">
                    {t('reviews.saved', { defaultValue: 'Bahoyingiz saqlandi' })}
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-6">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      {t('reviews.quality', { defaultValue: 'Ish sifati' })}
                    </label>
                    <div className="flex items-center gap-2" role="radiogroup" aria-label={t('reviews.quality', { defaultValue: 'Ish sifati' })}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onMouseEnter={() => setHovered(n)}
                          onMouseLeave={() => setHovered(0)}
                          onClick={() => setRating(n)}
                          aria-label={`${n}`}
                          aria-pressed={rating === n}
                          className="p-1 transition-transform hover:scale-110"
                        >
                          <Star
                            size={36}
                            className={n <= active ? 'text-amber-400' : 'text-gray-200'}
                            fill={n <= active ? 'currentColor' : 'none'}
                          />
                        </button>
                      ))}
                      <span className="ml-2 text-lg font-black text-gray-700">{rating}/5</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                      {t('reviews.comment', { defaultValue: 'Izoh (ixtiyoriy)' })}
                    </label>
                    <textarea
                      rows={4}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      maxLength={1000}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                      placeholder={t('reviews.comment_placeholder', {
                        defaultValue: 'Ishchi haqida fikringiz...',
                      })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50"
                  >
                    {loading
                      ? t('common.loading', { defaultValue: 'Saqlanmoqda...' })
                      : t('reviews.submit', { defaultValue: 'Bahoni yuborish' })}
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
