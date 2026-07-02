import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, AlertCircle, MessageSquare } from 'lucide-react';
import { Job, Profile } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { applicationService } from '../services/applicationService';

interface ApplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: Job | null;
  profile: Profile | null;
}

export default function ApplyModal({ isOpen, onClose, job, profile }: ApplyModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [message, setMessage] = React.useState('');
  const [coverLetter, setCoverLetter] = React.useState('');
  const [expectedSalary, setExpectedSalary] = React.useState(job?.price ? String(job.price) : '');
  const [loading, setLoading] = React.useState(false);
  const [success, setSuccess] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setMessage('');
      setCoverLetter('');
      setExpectedSalary(job?.price ? String(job.price) : '');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen, job]);

  if (!job) return null;

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const isDemo = profile.uid.startsWith('demo_');

      if (isDemo) {
        // Demo mode - just show success
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setMessage('');
          setCoverLetter('');
          setExpectedSalary(job.price ? String(job.price) : '');
        }, 1500);
        return;
      }

      // Real mode - use application service
      const applicationId = await applicationService.create({
        jobId: job.id,
        workerId: profile.uid,
        employerId: job.employerId,
        workerName: profile.fullName,
        workerEmail: profile.email,
        workerPhone: profile.phoneNumber || '',
        jobTitle: job.title,
        message: message,
        coverLetter: coverLetter,
        expectedSalary: expectedSalary
      });

      if (!applicationId) {
        setError(t('jobs.already_applied'));
        setLoading(false);
        return;
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setMessage('');
        navigate(`/worker/applications`);
      }, 1500);
    } catch (err) {
      debugLogger.error("Application error:", err);
      const errorMessage = err instanceof Error && err.message.includes('Already applied')
        ? t('jobs.already_applied')
        : t('common.error_occurred');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
            className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">{t('jobs.apply_title')}</h2>
                  <p className="text-gray-500 text-sm mt-1">{job.title}</p>
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
                <div className="py-12 text-center">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                    <Send size={40} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{t('jobs.apply_success')}</h3>
                  <p className="text-gray-500">{t('jobs.apply_success_desc')}</p>
                </div>
              ) : (
                <form onSubmit={handleApply} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">{t('jobs.applicant_info', { defaultValue: 'Ariza beruvchi ma’lumotlari' })}</div>
                      <div className="text-sm text-slate-700">
                        <div className="font-semibold">{profile.fullName}</div>
                        <div className="text-sm text-slate-500">{profile.email}</div>
                        <div className="text-sm text-slate-500">{profile.phoneNumber || t('jobs.no_phone', { defaultValue: 'Telefon yo‘q' })}</div>
                      </div>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
                      <div className="text-xs font-bold uppercase tracking-[0.28em] text-slate-500">{t('jobs.job_details', { defaultValue: 'Ish ta’rifi' })}</div>
                      <div className="text-sm text-slate-700">
                        <div className="font-semibold">{job.title}</div>
                        <div className="text-sm text-slate-500">{job.category || t('jobs.general_category')}</div>
                        <div className="text-sm text-slate-500">{job.region}{job.district ? `, ${job.district}` : ''}</div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('jobs.cover_letter', { defaultValue: 'Ariza matni' })}</label>
                    <textarea
                      required
                      rows={5}
                      value={coverLetter}
                      onChange={(e) => setCoverLetter(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                      placeholder={t('jobs.cover_letter_placeholder', { defaultValue: 'Nega bu ishga mos ekansiz, o‘zingiz haqingizda qisqacha yozing' })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('jobs.expected_salary', { defaultValue: 'Kutgan maosh' })}</label>
                    <input
                      type="text"
                      value={expectedSalary}
                      onChange={(e) => setExpectedSalary(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                      placeholder={t('jobs.expected_salary_placeholder', { defaultValue: 'Misol: 1 500 000 so‘m' })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{t('jobs.short_message', { defaultValue: 'Qisqacha izoh' })}</label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-5 py-4 rounded-2xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none text-sm"
                      placeholder={t('jobs.short_message_placeholder', { defaultValue: 'Qo‘shimcha izoh yoki aloqa ma’lumotlari' })}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !coverLetter}
                    className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50"
                  >
                    {loading ? t('auth.sending') : t('jobs.send_application')}
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
