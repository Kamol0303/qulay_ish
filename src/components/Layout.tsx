import React from 'react';
import Header from './Header';
import { useTranslation } from 'react-i18next';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {children}
      </main>
      <footer className="bg-card border-t border-border py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-xl">Q</span>
                </div>
                <span className="text-xl font-bold text-foreground tracking-tight">{t('common.branding')}</span>
              </div>
              <p className="text-muted-foreground text-sm max-w-xs mb-6">
                {t('common.footer_desc')}
              </p>
              <div className="flex space-x-4">
                {/* Social icons */}
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <span className="text-xs font-bold">TG</span>
                </div>
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <span className="text-xs font-bold">IG</span>
                </div>
                <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center text-muted-foreground hover:text-primary transition-colors cursor-pointer">
                  <span className="text-xs font-bold">FB</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">{t('common.platform')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/jobs" className="hover:text-primary transition-colors">{t('nav.jobs_link')}</a></li>
                <li><a href="/workers" className="hover:text-primary transition-colors">{t('nav.workers_link')}</a></li>
                <li><a href="/statistics" className="hover:text-primary transition-colors">{t('nav.statistics')}</a></li>
                <li><a href="/about" className="hover:text-primary transition-colors">{t('nav.about')}</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4">{t('common.help')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="/faq" className="hover:text-primary transition-colors">{t('nav.faq')}</a></li>
                <li><a href="/contact" className="hover:text-primary transition-colors">{t('nav.contact')}</a></li>
                <li><a href="/privacy" className="hover:text-primary transition-colors">{t('nav.privacy')}</a></li>
                <li><a href="/terms" className="hover:text-primary transition-colors">{t('nav.terms')}</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
            <p>© 2026 {t('common.branding')}. {t('common.all_rights_reserved')}</p>
            <p className="mt-2 md:mt-0">{t('common.made_with_love')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
