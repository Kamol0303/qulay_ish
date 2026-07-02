import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { LogOut, User, Briefcase, BarChart2, MessageSquare, Menu, X, Globe, ChevronDown, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguageCode } from '../lib/utils';

export default function Header() {
  const { user, profile, signOut: authSignOut } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const [isLangOpen, setIsLangOpen] = React.useState(false);

  const handleLogout = async () => {
    await authSignOut();
    navigate('/');
  };

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    setIsLangOpen(false);
  };

  const languages = [
    { code: 'uz', name: t('common.uzbek'), flag: '🇺🇿' },
    { code: 'ru', name: t('common.russian'), flag: '🇷🇺' },
    { code: 'en', name: t('common.english'), flag: '🇺🇸' },
  ];

  const currentLanguageCode = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  const currentLanguage = languages.find((l) => l.code === currentLanguageCode) || languages[0];

  const navLinks = [
    { name: t('nav.jobs_link'), path: '/jobs', icon: Briefcase },
    { name: t('nav.statistics'), path: '/statistics', icon: BarChart2 },
  ];

  return (
    <header className="bg-card border-b border-border sticky top-0 z-50 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center space-x-3 group">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm border border-slate-100 overflow-hidden">
                <img 
                  src="https://samarkand.uz/templates/dreamzero/img/gerb-flag.png" 
                  alt="Uzbekistan Gerb" 
                  className="w-8 h-8 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider leading-tight">
                  {t('common.branding_top')}
                </span>
                <span className="text-[11px] font-bold text-slate-900 leading-tight">
                  {t('common.branding_bottom')}
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="text-muted-foreground hover:text-primary font-medium transition-colors flex items-center space-x-1"
              >
                <link.icon size={18} />
                <span>{link.name}</span>
              </Link>
            ))}
            
            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="flex items-center space-x-1 text-muted-foreground hover:text-primary font-medium transition-colors p-2 rounded-xl hover:bg-secondary"
              >
                <Globe size={18} />
                <span className="uppercase text-xs font-bold">{currentLanguage.code}</span>
                <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isLangOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-40 bg-card border border-border rounded-2xl shadow-xl overflow-hidden py-1"
                  >
                    {languages.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => changeLanguage(lang.code)}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center space-x-3 hover:bg-secondary transition-colors ${
                          currentLanguageCode === lang.code ? 'text-primary bg-primary/5' : 'text-foreground'
                        }`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.name}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {user ? (
              <div className="flex items-center space-x-4">
                <Link to="/chat" className="text-muted-foreground hover:text-primary transition-colors relative">
                  <MessageSquare size={20} />
                </Link>
                {profile?.role === 'worker' && (
                  <Link
                    to="/my-profile"
                    className="flex items-center space-x-2 bg-primary/5 text-primary px-3 py-1.5 rounded-full border border-primary/20 hover:bg-primary/10 transition-colors"
                  >
                    <Briefcase size={18} />
                    <span className="text-sm font-medium">{t('nav.resume')}</span>
                  </Link>
                )}
                <Link
                  to={profile?.role === 'worker' ? '/my-profile' : profile?.role === 'employer' ? '/employer/dashboard' : '/admin/dashboard'}
                  className="flex items-center space-x-2 bg-secondary px-3 py-1.5 rounded-full border border-border hover:bg-muted transition-colors"
                >
                  <User size={18} className="text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{profile?.fullName || t('nav.profile')}</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-muted-foreground hover:text-destructive transition-colors"
                  title={t('nav.logout')}
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/auth?mode=register"
                  className="bg-secondary text-foreground px-4 py-2 rounded-full font-semibold hover:bg-muted transition-all border border-border"
                >
                  {t('nav.register') || 'Ro‘yxatdan o‘tish'}
                </Link>
                <Link
                  to="/auth?mode=login"
                  className="bg-primary text-primary-foreground px-5 py-2 rounded-full font-semibold hover:bg-primary/90 transition-all shadow-sm"
                >
                  {t('nav.login')}
                </Link>
              </div>
            )}
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-600 hover:text-gray-900 p-2"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-card border-t border-border overflow-hidden"
          >
            <div className="px-4 pt-2 pb-6 space-y-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsMenuOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-foreground hover:bg-secondary rounded-lg flex items-center space-x-3"
                >
                  <link.icon size={20} className="text-muted-foreground" />
                  <span>{link.name}</span>
                </Link>
              ))}
              
              <div className="pt-4 pb-2 px-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3 ml-1">{t('common.language') || 'Til'}</p>
                <div className="grid grid-cols-3 gap-2">
                  {languages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code)}
                      className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all ${
                        currentLanguageCode === lang.code 
                          ? 'bg-primary/10 border-primary text-primary' 
                          : 'bg-secondary border-border text-foreground'
                      }`}
                    >
                      <span className="text-lg mb-1">{lang.flag}</span>
                      <span className="text-[10px] font-bold uppercase">{lang.code}</span>
                    </button>
                  ))}
                </div>
              </div>

              {user ? (
                <>
                  <Link
                    to="/chat"
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-3 text-base font-medium text-foreground hover:bg-secondary rounded-lg flex items-center space-x-3"
                  >
                    <MessageSquare size={20} className="text-muted-foreground" />
                    <span>{t('nav.chat')}</span>
                  </Link>
                  {profile?.role === 'worker' && (
                    <Link
                      to="/my-profile"
                      onClick={() => setIsMenuOpen(false)}
                      className="block px-3 py-3 text-base font-medium text-foreground hover:bg-secondary rounded-lg flex items-center space-x-3"
                    >
                      <Briefcase size={20} className="text-muted-foreground" />
                      <span>{t('nav.resume')}</span>
                    </Link>
                  )}
                  <Link
                    to={profile?.role === 'worker' ? '/my-profile' : profile?.role === 'employer' ? '/employer/dashboard' : '/admin/dashboard'}
                    onClick={() => setIsMenuOpen(false)}
                    className="block px-3 py-3 text-base font-medium text-foreground hover:bg-secondary rounded-lg flex items-center space-x-3"
                  >
                    <User size={20} className="text-muted-foreground" />
                    <span>{t('nav.profile')}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-3 py-3 text-base font-medium text-destructive hover:bg-destructive/10 rounded-lg flex items-center space-x-3"
                  >
                    <LogOut size={20} />
                    <span>{t('nav.logout')}</span>
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/auth?mode=register"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full text-center bg-secondary text-foreground px-5 py-3 rounded-xl font-semibold border border-border hover:bg-muted transition-colors"
                  >
                    {t('nav.register') || 'Ro‘yxatdan o‘tish'}
                  </Link>
                  <Link
                    to="/auth?mode=login"
                    onClick={() => setIsMenuOpen(false)}
                    className="block w-full text-center bg-primary text-primary-foreground px-5 py-3 rounded-xl font-semibold mt-2"
                  >
                    {t('nav.login')}
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
