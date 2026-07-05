import { debugLogger } from '../lib/debugLogger';
import React, { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { VerificationRequest } from '../types';
import { ShieldCheck, Upload, CheckCircle, Clock, AlertTriangle, User, FileText, Camera, ChevronRight, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function VerificationPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [request, setRequest] = useState<VerificationRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    idPhotoUrl: '',
    selfieUrl: ''
  });

  useEffect(() => {
    async function fetchRequest() {
      if (!profile?.uid) return;
      try {
        const rows = await api.verificationRequests.list({ userId: profile.uid });
        if (rows.length > 0) {
          setRequest(rows[0]);
        }
      } catch (error) {
        debugLogger.error('Error fetching verification request:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchRequest();
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) return;
    setSubmitting(true);

    try {
      // In a real app, we would upload files to Storage first
      // For this demo, we'll use placeholder URLs
      const created = await api.verificationRequests.create({
        userId: profile.uid,
        idPhotoUrl: formData.idPhotoUrl || 'https://picsum.photos/seed/id/800/600',
        selfieUrl: formData.selfieUrl || 'https://picsum.photos/seed/selfie/800/600',
        status: 'pending',
      });
      setRequest(created);

      await api.users.update(profile.uid, { verificationStatus: 'pending' });

    } catch (error) {
      debugLogger.error('Error submitting verification request:', error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-4 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 border border-gray-200 dark:border-slate-700 rounded-2xl text-gray-900 dark:text-white font-bold transition-all shadow-sm"
        >
          <ArrowLeft size={18} />
          {t('common.back')}
        </button>
        <div className="flex items-center gap-4">
          <div className="p-4 bg-primary/10 rounded-3xl text-primary">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight">{t('verification.title')}</h2>
            <p className="text-muted-foreground mt-1">{t('verification.subtitle')}</p>
          </div>
        </div>

        {request ? (
          <div className="bg-card p-10 rounded-[2.5rem] border border-border shadow-sm text-center space-y-6">
            {request.status === 'pending' ? (
              <>
                <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
                  <Clock className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t('verification.pending_title')}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t('verification.pending_desc')}
                </p>
                <div className="pt-6 grid grid-cols-2 gap-4 max-w-sm mx-auto">
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase">{t('verification.id_submitted')}</p>
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto mt-2" />
                  </div>
                  <div className="p-4 bg-secondary/50 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground uppercase">{t('verification.selfie_submitted')}</p>
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto mt-2" />
                  </div>
                </div>
              </>
            ) : request.status === 'approved' ? (
              <>
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
                  <ShieldCheck className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t('verification.approved_title')}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t('verification.approved_desc')}
                </p>
                <div className="pt-6">
                  <div className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-2xl font-bold">
                    <ShieldCheck className="w-5 h-5" />
                    {t('verification.verified_user')}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                  <AlertTriangle className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-foreground">{t('verification.rejected_title')}</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {t('verification.rejected_desc')}
                </p>
                <button
                  onClick={() => setRequest(null)}
                  className="mt-6 px-8 py-3 bg-primary text-primary-foreground rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                >
                  {t('verification.try_again')}
                </button>
              </>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card p-10 rounded-[2.5rem] border border-border shadow-sm space-y-8">
              <section className="space-y-6">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  {t('verification.id_document')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('verification.id_desc')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
                    <div className="aspect-[4/3] bg-secondary/50 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 group-hover:border-primary transition-all overflow-hidden">
                      {formData.idPhotoUrl ? (
                        <img src={formData.idPhotoUrl} alt="ID" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                            <Upload className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-bold text-muted-foreground">{t('verification.upload_id')}</p>
                        </>
                      )}
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setFormData(prev => ({ ...prev, idPhotoUrl: 'https://picsum.photos/seed/id-front/800/600' }))}
                      />
                    </div>
                  </div>
                  <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 space-y-3">
                    <h4 className="font-bold text-primary flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      {t('verification.requirements')}
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-2">
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" /> {t('verification.req_name')}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" /> {t('verification.req_clear')}</li>
                      <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-green-500" /> {t('verification.req_valid')}</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                  <Camera className="w-5 h-5 text-primary" />
                  {t('verification.selfie_verification')}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t('verification.selfie_desc')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="relative group">
                    <div className="aspect-square bg-secondary/50 rounded-3xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-4 group-hover:border-primary transition-all overflow-hidden">
                      {formData.selfieUrl ? (
                        <img src={formData.selfieUrl} alt="Selfie" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <>
                          <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                            <Camera className="w-8 h-8" />
                          </div>
                          <p className="text-sm font-bold text-muted-foreground">{t('verification.take_selfie')}</p>
                        </>
                      )}
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={(e) => setFormData(prev => ({ ...prev, selfieUrl: 'https://picsum.photos/seed/selfie-user/800/800' }))}
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="p-6 bg-secondary/30 rounded-3xl border border-border">
                      <p className="text-sm font-medium text-foreground italic">
                        {t('verification.privacy_note')}
                      </p>
                    </div>
                    <div className="p-6 bg-amber-500/10 rounded-3xl border border-amber-500/20 flex gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                      <p className="text-xs text-amber-700">
                        {t('verification.lighting_note')}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !formData.idPhotoUrl || !formData.selfieUrl}
                className="px-12 py-4 bg-primary text-primary-foreground rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all disabled:opacity-50"
              >
                {submitting ? t('verification.submitting') : t('verification.submit_btn')}
              </button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
