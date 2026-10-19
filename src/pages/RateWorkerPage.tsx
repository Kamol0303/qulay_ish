import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/DashboardLayout';
import ReviewModal from '../components/ReviewModal';
import StarRow from '../components/StarRow';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import type { Application, Review } from '../types';

function RateContent() {
  const { applicationId = '' } = useParams();
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [application, setApplication] = useState<Application | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!applicationId || !profile?.uid) return;
    let cancelled = false;
    setLoading(true);
    void api.applications
      .get(applicationId)
      .then(async (row) => {
        if (cancelled) return;
        setApplication(row);
        if (row.reviewed) {
          const reviews = await api.reviews.list({ workerId: row.workerId }).catch(() => []);
          if (!cancelled) {
            setReview(reviews.find((item) => item.applicationId === row.id) || reviews[0] || null);
          }
        } else if (row.employerId === profile.uid && row.status === 'completed') {
          setOpen(true);
        }
      })
      .catch(() => {
        if (!cancelled) setMissing(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [applicationId, profile?.uid]);

  const mine = application?.employerId === profile?.uid;
  const ready = application?.status === 'completed' && !application.reviewed;

  return (
    <div className="mx-auto max-w-lg space-y-4 px-1 py-4">
      <h1 className="text-2xl font-black text-foreground">{t('reviews.title')}</h1>
      {loading ? <p className="text-sm text-muted-foreground">{t('common.loading')}</p> : null}
      {missing ? <p className="text-sm font-semibold text-red-600">{t('reviews.not_found')}</p> : null}
      {application && !mine ? <p className="text-sm font-semibold text-slate-600">{t('reviews.only_hirer')}</p> : null}
      {application && mine && application.status !== 'completed' ? (
        <p className="text-sm font-semibold text-slate-600">{t('reviews.wait_finish')}</p>
      ) : null}
      {application && mine && application.reviewed ? (
        <div className="rounded-3xl border border-border bg-card p-5">
          <p className="font-black text-foreground">{application.workerName}</p>
          <p className="mt-1 text-sm text-muted-foreground">{application.jobTitle}</p>
          <div className="mt-3">
            <StarRow rating={review?.rating || 5} size={22} />
          </div>
          {review?.comment ? <p className="mt-3 text-sm text-slate-600">{review.comment}</p> : null}
          <p className="mt-3 text-sm font-semibold text-emerald-700">{t('reviews.saved')}</p>
        </div>
      ) : null}
      {application && mine && ready ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="min-h-12 w-full rounded-2xl bg-amber-500 px-5 font-bold text-white"
        >
          {t('reviews.rate_worker')}
        </button>
      ) : null}
      <ReviewModal
        isOpen={open && Boolean(application) && mine && ready}
        onClose={() => setOpen(false)}
        applicationId={applicationId}
        workerName={application?.workerName}
        jobTitle={application?.jobTitle}
        onSubmitted={(rating) => {
          setApplication((current) => (current ? { ...current, reviewed: true } : current));
          setReview({ id: 'saved', reviewerId: profile?.uid || '', revieweeId: application?.workerId || '', rating });
        }}
      />
    </div>
  );
}

export default function RateWorkerPage() {
  return (
    <DashboardLayout>
      <RateContent />
    </DashboardLayout>
  );
}
