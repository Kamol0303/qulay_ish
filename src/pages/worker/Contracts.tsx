import { debugLogger } from '../../lib/debugLogger';
import React, { useEffect, useState } from 'react';
import DashboardLayout from '../../components/DashboardLayout';
import { useAuth } from '../../hooks/useAuth';
import { db } from '../../firebase';
import { collection, query, where, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { Contract, Profile, Job } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, CheckCircle, User, Briefcase, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { uz, ru, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

function safeFormatDate(value: any, fmt: string, options: any): string {
  try {
    if (!value) return '-';
    const date = value?.toDate ? value.toDate() : new Date(value);
    if (isNaN(date.getTime())) return '-';
    return format(date, fmt, options);
  } catch {
    return '-';
  }
}

export default function WorkerContracts() {
  const { t, i18n } = useTranslation();
  const { profile, isDemo } = useAuth();
  const [loading, setLoading] = useState(true);
  const [contracts, setContracts] = useState<(Contract & { employer?: Profile; job?: Job })[]>([]);

  const getDateLocale = () => {
    switch (i18n.language) {
      case 'ru': return ru;
      case 'en': return enUS;
      default: return uz;
    }
  };

  useEffect(() => {
    async function fetchContracts() {
      if (!profile?.uid) return;
      setLoading(true);

      if (isDemo) {
        setContracts([]);
        setLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'contracts'),
          where('workerId', '==', profile.uid),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        const contractsData = snap.docs.map(d => ({ id: d.id, ...d.data() } as Contract));

        const combined = await Promise.all(contractsData.map(async (contract) => {
          const employerSnap = await getDocs(query(collection(db, 'profiles'), where('uid', '==', contract.employerId)));
          const employer = employerSnap.docs[0]?.data() as Profile;

          let job: Job | undefined;
          if (contract.jobId) {
            const jobSnap = await getDocs(query(collection(db, 'jobs'), where('__name__', '==', contract.jobId)));
            job = jobSnap.docs[0]?.data() as Job;
          }

          return { ...contract, employer, job };
        }));

        setContracts(combined);
      } catch (error) {
        debugLogger.error('Error fetching contracts:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();
  }, [profile, isDemo]);

  const handleSign = async (contractId: string) => {
    try {
      await updateDoc(doc(db, 'contracts', contractId), {
        workerSigned: true,
        status: 'active'
      });
      setContracts(prev => prev.map(c => c.id === contractId ? { ...c, workerSigned: true, status: 'active' } : c));
    } catch (error) {
      debugLogger.error('Error signing contract:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('nav.sidebar.contracts')}</h2>
          <p className="text-muted-foreground mt-2">{t('worker.dashboard.contracts_desc')}</p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-secondary/50 rounded-3xl animate-pulse"></div>
            ))}
          </div>
        ) : contracts.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            <AnimatePresence mode="popLayout">
              {contracts.map((contract) => (
                <motion.div
                  key={contract.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card rounded-[32px] border border-border shadow-sm overflow-hidden hover:shadow-md transition-all"
                >
                  <div className="p-8">
                    <div className="flex flex-col lg:flex-row gap-8">
                      {/* Employer Info */}
                      <div className="flex items-start gap-4 min-w-[240px]">
                        <div className="w-16 h-16 rounded-2xl bg-secondary overflow-hidden border border-border">
                          {contract.employer?.photoUrl ? (
                            <img src={contract.employer.photoUrl} alt={contract.employer.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                              <User size={32} />
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-foreground">{contract.employer?.fullName || t('common.unknown')}</h4>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{t('auth.employer')}</p>
                          <div className="flex items-center gap-2 mt-3">
                            <Link
                              to={`/chat?with=${contract.employerId}`}
                              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              {t('worker_profile.start_chat')} <ChevronRight size={12} />
                            </Link>
                          </div>
                        </div>
                      </div>

                      {/* Contract Content */}
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          <Briefcase size={14} />
                          <span>{t('contract.job_details')}: {contract.job?.title || t('jobs.deleted_job', { defaultValue: 'Deleted job' })}</span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('common.price')}</p>
                            <p className="text-lg font-bold text-primary">{(contract.amount ?? 0).toLocaleString()} {t('common.uzs')}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('common.duration', { defaultValue: 'Duration' })}</p>
                            <p className="text-sm font-bold">
                              {safeFormatDate(contract.startDate, 'd MMM', { locale: getDateLocale() })} - {safeFormatDate(contract.endDate, 'd MMM', { locale: getDateLocale() })}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t('common.status')}</p>
                            <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mt-1 ${
                              contract.status === 'active' ? 'bg-green-50 text-green-600' :
                              contract.status === 'draft' ? 'bg-amber-50 text-amber-600' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {contract.status === 'active' ? t('common.active') : contract.status === 'draft' ? t('common.pending') : t('common.closed')}
                            </span>
                          </div>
                        </div>

                        {contract.terms && (
                          <div className="bg-secondary/30 p-5 rounded-2xl border border-border/50 text-muted-foreground text-sm leading-relaxed line-clamp-2">
                            {contract.terms}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col justify-center gap-3 min-w-[200px]">
                        {!contract.workerSigned ? (
                          <button
                            onClick={() => handleSign(contract.id)}
                            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                          >
                            <CheckCircle size={18} />
                            {t('contract.sign')}
                          </button>
                        ) : (
                          <div className="py-3 bg-green-50 text-green-700 border border-green-100 rounded-xl font-bold flex items-center justify-center gap-2">
                            <CheckCircle size={18} />
                            {t('contract.signed_digital')}
                          </div>
                        )}

                        <Link
                          to={`/contracts/${contract.id}`}
                          className="w-full py-3 bg-card border border-border rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-secondary transition-all"
                        >
                          <FileText size={18} />
                          {t('notifications.view_details')}
                        </Link>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="bg-secondary/20 rounded-[40px] p-20 text-center border-2 border-dashed border-border">
            <div className="w-20 h-20 bg-card rounded-full flex items-center justify-center mx-auto mb-6 text-muted-foreground shadow-sm">
              <FileText size={40} />
            </div>
            <h3 className="text-xl font-bold text-foreground">{t('worker.dashboard.no_contracts')}</h3>
            <p className="text-muted-foreground mt-2">{t('worker.dashboard.no_contracts_desc')}</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
