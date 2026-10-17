import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bindDialogHost, type DialogRequest } from '../lib/appDialog';

/** In-app alerts. Native alert/confirm/prompt closes the APK on some phones. */
export default function AppDialogHost() {
  const { t } = useTranslation();
  const [request, setRequest] = useState<DialogRequest | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    bindDialogHost((next) => {
      setDraft('');
      setRequest(next);
    });
    return () => bindDialogHost(null);
  }, []);

  if (!request) return null;

  const close = () => {
    if (request.kind === 'confirm') request.resolve(false);
    else if (request.kind === 'prompt') request.resolve(null);
    else request.resolve();
    setRequest(null);
  };

  const accept = () => {
    if (request.kind === 'confirm') request.resolve(true);
    else if (request.kind === 'prompt') request.resolve(draft);
    else request.resolve();
    setRequest(null);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 bg-black/60" role="presentation" onClick={close}>
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl bg-white text-slate-900 shadow-2xl p-5"
        style={{ colorScheme: 'light' }}
        onClick={(event) => event.stopPropagation()}
      >
        {request.kind === 'frame' ? (
          <>
            <div className="h-[70vh] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              <iframe title="content" src={request.url} className="h-full w-full bg-white" />
            </div>
            <button type="button" onClick={close} className="mt-4 min-h-[44px] w-full rounded-2xl bg-blue-600 font-bold text-white">
              {t('common.close', { defaultValue: 'Yopish' })}
            </button>
          </>
        ) : (
          <>
            <p className="text-base font-semibold leading-relaxed whitespace-pre-wrap">{request.message}</p>
            {request.kind === 'prompt' && (
              <input
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none"
              />
            )}
            <div className="mt-5 flex gap-3">
              {request.kind !== 'alert' && (
                <button type="button" onClick={close} className="min-h-[44px] flex-1 rounded-2xl border border-slate-200 font-bold text-slate-700">
                  {t('common.cancel')}
                </button>
              )}
              <button type="button" onClick={accept} className="min-h-[44px] flex-1 rounded-2xl bg-blue-600 font-bold text-white">
                {request.kind === 'confirm' ? t('common.yes', { defaultValue: 'Ha' }) : t('common.ok', { defaultValue: 'OK' })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
