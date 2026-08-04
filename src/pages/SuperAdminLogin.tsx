import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Shield, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { toUserMessage } from '../lib/api/errors';
import { useAuth } from '../hooks/useAuth';

export default function SuperAdminLogin() {
  const navigate = useNavigate();
  const { setAuthProfile } = useAuth();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!login.trim() || !password) {
      setError('Login va parol majburiy');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      localStorage.removeItem('qulay_ish_demo_session');
      // Credentials are validated on the API (api/.env) — no VITE_* gate on the frontend.
      const result = await api.auth.superAdminLogin(login.trim(), password);
      setAuthProfile(result.user);
      navigate('/super-admin/dashboard');
    } catch (err) {
      setError(toUserMessage(err, "Telefon/email yoki parol noto'g'ri."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-900 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2">
          <div className="bg-red-600 text-white px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-2xl border-2 border-red-400">
            <Shield className="inline w-4 h-4 mr-2" />
            Restricted Access
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-[40px] p-10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Shield size={40} className="text-white" />
            </div>
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Super Admin</h1>
            <p className="text-red-200 text-sm font-medium">Platform Control Center</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-2xl flex items-center gap-3 text-red-200"
            >
              <AlertCircle size={20} />
              <p className="text-sm font-medium">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-2">
                Email yoki telefon
              </label>
              <input
                type="text"
                required
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all"
                placeholder="superadmin@qulay-ish.local yoki +998..."
                autoComplete="username"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-white/80 uppercase tracking-wider mb-2">
                Parol
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-2xl text-white placeholder-white/40 focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all pr-12"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-red-400 rounded-lg"
                  aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko\'rsatish'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-red-700 transition-all shadow-2xl shadow-red-600/50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Tekshirilmoqda...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  Kirish
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-xs text-white/60 text-center leading-relaxed">
              Faqat Super Admin. Kirish maʼlumotlari serverdagi <code className="text-white/80">api/.env</code> orqali tekshiriladi.
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-white/60 hover:text-white transition-colors font-medium"
            >
              ← Platformaga qaytish
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
