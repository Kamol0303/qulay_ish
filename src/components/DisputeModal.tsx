import { debugLogger } from '../lib/debugLogger';
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, X, Send, ShieldAlert } from 'lucide-react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';

interface DisputeModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  openedById: string;
}

export default function DisputeModal({ isOpen, onClose, contractId, openedById }: DisputeModalProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'disputes'), {
        contractId,
        openedById,
        reason,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Update contract status
      await updateDoc(doc(db, 'contracts', contractId), {
        status: 'disputed'
      });

      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setReason('');
      }, 2000);
    } catch (error) {
      debugLogger.error('Error opening dispute:', error);
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
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-card rounded-[40px] border border-border shadow-2xl overflow-hidden"
          >
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3 text-destructive">
                  <div className="p-3 bg-destructive/10 rounded-2xl">
                    <ShieldAlert size={24} />
                  </div>
                  <h3 className="text-2xl font-black tracking-tight">{t('dispute.title')}</h3>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-secondary rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              {success ? (
                <div className="py-12 text-center space-y-4">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                    <Send size={40} />
                  </div>
                  <h4 className="text-xl font-bold text-foreground">{t('dispute.success_title')}</h4>
                  <p className="text-muted-foreground">{t('dispute.success_desc')}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl flex gap-4">
                    <AlertTriangle className="text-amber-600 shrink-0" size={24} />
                    <p className="text-sm text-amber-800 leading-relaxed font-medium">
                      {t('dispute.hint')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-muted-foreground uppercase tracking-widest ml-1">{t('dispute.reason_label')}</label>
                    <textarea
                      required
                      rows={5}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder={t('dispute.reason_placeholder')}
                      className="w-full px-5 py-4 bg-secondary/30 border border-border rounded-2xl focus:ring-2 focus:ring-destructive outline-none font-medium leading-relaxed"
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-destructive text-destructive-foreground rounded-[24px] font-black text-lg shadow-xl shadow-destructive/20 hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {loading ? t('auth.sending') : (
                      <>
                        <Send size={24} />
                        {t('dispute.submit')}
                      </>
                    )}
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
