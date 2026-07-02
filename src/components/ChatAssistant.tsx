import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Sparkles, Bot, User, Loader2, Maximize2, Minimize2,
  HelpCircle, Briefcase, Search, FileText, Send
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import ReactMarkdown from 'react-markdown';
import { useTranslation } from 'react-i18next';
import type { AILanguage } from '../services/aiAssistantService';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const PREDEFINED_RESPONSES: Record<AILanguage, Record<string, string>> = {
  uz: {
    jobs_search: `**Ish qidirish:**\n\n1. "Ishlar" bo'limiga o'ting\n2. Qidiruv maydonida kalit so'zlarni kiriting\n3. Filtrlardan foydalaning:\n   - Tuman bo'yicha\n   - Toifa bo'yicha\n   - Narx oralig'i bo'yicha\n4. Mos keladigan ishga "Ariza topshirish" tugmasini bosing\n\n**Maslahat:** Profilingizni to'ldiring!`,
    post_job: `**Ish e'lon qilish:**\n\n1. Ish beruvchi paneliga kiring\n2. "Yangi e'lon berish" tugmasini bosing\n3. Ma'lumotlarni to'ldiring\n4. "Yuborish" tugmasini bosing\n\n**Eslatma:** E'loningiz 30 kun davomida faol bo'ladi!`,
    contract: `**Shartnoma tuzish:**\n\n1. Nomzod bilan kelishib oling\n2. "Shartnoma tuzish" tugmasini bosing\n3. Shartlarni kiriting\n4. Ikkala tomon imzolashi kerak\n\n**Muhim:** Shartnoma qonuniy hujjat!`,
    dispute: `**Nizo yuzaga kelsa:**\n\n1. Shartnoma sahifasiga o'ting\n2. "Nizo ochish" tugmasini bosing\n3. Muammoni yozing\n4. Admin 24-48 soat ichida ko'rib chiqadi`,
    profile: `**Profilni to'ldirish:**\n\n1. "Profil" bo'limiga o'ting\n2. Ma'lumotlarni qo'shing\n3. Rasm yuklang\n4. "Saqlash" tugmasini bosing`,
    default: `Kechirasiz, men faqat QULAY ISH platformasi bo'yicha yordam bera olaman. Ish qidirish, ariza topshirish, shartnoma tuzish haqida savol bering.`
  },
  ru: {
    jobs_search: `**Поиск работы:**\n\n1. Перейдите в раздел **Работа**\n2. Введите ключевые слова\n3. Используйте фильтры\n4. Нажмите **Подать заявку**\n\n**Совет:** Заполните профиль!`,
    post_job: `**Размещение вакансии:**\n\n1. Откройте панель работодателя\n2. Нажмите **Разместить вакансию**\n3. Заполните данные\n4. Нажмите **Опубликовать**`,
    contract: `**Создание контракта:**\n\n1. Договоритесь с кандидатом\n2. Нажмите **Создать контракт**\n3. Укажите условия\n4. Обе стороны подписывают`,
    dispute: `**Если возник спор:**\n\n1. Перейдите на страницу контракта\n2. Нажмите **Открыть спор**\n3. Опишите проблему\n4. Админ рассмотрит за 24-48 часов`,
    profile: `**Заполнение профиля:**\n\n1. Перейдите в **Мой профиль**\n2. Добавьте данные\n3. Загрузите фото\n4. Нажмите **Сохранить**`,
    default: `Извините, я могу помочь только по вопросам платформы QULAY ISH. Задавайте вопросы о поиске работы, заявках, контрактах.`
  },
  en: {
    jobs_search: `**Finding a Job:**\n\n1. Go to the **Jobs** section\n2. Enter keywords\n3. Use filters\n4. Click **Apply**\n\n**Tip:** Complete your profile!`,
    post_job: `**Posting a Job:**\n\n1. Open employer dashboard\n2. Click **Post New Job**\n3. Fill in details\n4. Click **Publish**`,
    contract: `**Creating a Contract:**\n\n1. Agree with candidate\n2. Click **Create Contract**\n3. Enter terms\n4. Both parties sign`,
    dispute: `**If a Dispute Arises:**\n\n1. Go to contract page\n2. Click **Open Dispute**\n3. Describe the issue\n4. Admin reviews within 24-48 hours`,
    profile: `**Completing Profile:**\n\n1. Go to **My Profile**\n2. Add information\n3. Upload photo\n4. Click **Save**`,
    default: `Sorry, I can only help with QULAY ISH platform questions. Ask about job search, applications, contracts.`
  }
};

export default function ChatAssistant() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language?.slice(0, 2) as AILanguage) in { uz: 1, ru: 1, en: 1 }
    ? (i18n.language.slice(0, 2) as AILanguage)
    : 'uz';
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: t('chat.ai_welcome', { name: profile?.fullName || t('common.unknown') })
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInputMessage('');
    setLoading(true);

    setTimeout(() => {
      const langResponses = PREDEFINED_RESPONSES[lang] ?? PREDEFINED_RESPONSES.uz;
      const query = text.toLowerCase();
      
      let response = langResponses.default;
      
      if (query.includes('ish') || query.includes('job') || query.includes('работ') || query.includes('вакан')) {
        response = langResponses.jobs_search;
      } else if (query.includes('joylashtir') || query.includes('post') || query.includes('размест')) {
        response = langResponses.post_job;
      } else if (query.includes('shartnoma') || query.includes('contract') || query.includes('контракт')) {
        response = langResponses.contract;
      } else if (query.includes('nizo') || query.includes('dispute') || query.includes('спор')) {
        response = langResponses.dispute;
      } else if (query.includes('profil') || query.includes('profile') || query.includes('профиль')) {
        response = langResponses.profile;
      }
      
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: response }
      ]);
      setLoading(false);
    }, 500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  const handleQuestionClick = (questionText: string) => {
    sendMessage(questionText);
  };

  const questions = [
    {
      key: 'jobs_search',
      icon: Search,
      label: t('chat.ai_label_jobs'),
      text: t('chat.ai_prompt_jobs'),
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-300'
    },
    {
      key: 'post_job',
      icon: Briefcase,
      label: t('chat.ai_label_post'),
      text: t('chat.ai_prompt_post'),
      iconBg: 'bg-emerald-500/20',
      iconColor: 'text-emerald-300'
    },
    {
      key: 'contract',
      icon: FileText,
      label: t('chat.ai_label_contract'),
      text: t('chat.ai_prompt_contract'),
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-300'
    },
    {
      key: 'dispute',
      icon: HelpCircle,
      label: t('chat.ai_label_dispute'),
      text: t('chat.ai_prompt_dispute'),
      iconBg: 'bg-amber-500/20',
      iconColor: 'text-amber-300'
    },
  ];

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 right-8 z-50 w-16 h-16 bg-blue-600 hover:bg-blue-500 text-white rounded-full shadow-2xl shadow-blue-600/40 flex items-center justify-center group transition-colors duration-200"
      >
        {isOpen ? <X size={28} /> : <Sparkles size={28} className="group-hover:rotate-12 transition-transform" />}
        {!isOpen && (
          <span className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center animate-bounce shadow-lg">
            AI
          </span>
        )}
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-28 right-8 z-50 flex flex-col overflow-hidden shadow-2xl transition-all duration-300 ${
              isExpanded ? 'w-[600px] h-[700px] rounded-[40px]' : 'w-[400px] h-[560px] rounded-[32px]'
            }`}
            style={{
              background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 100%)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 32px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset'
            }}
          >
            <div
              className="p-5 flex items-center justify-between shrink-0"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                borderBottom: '1px solid rgba(255,255,255,0.15)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/25 shadow-inner">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="font-black text-white tracking-tight text-sm">{t('chat.ai_assistant')}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100">{t('chat.ai_online')}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
                >
                  {isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white/80 hover:text-white"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth"
              style={{ background: 'rgba(15, 23, 42, 0.6)' }}
            >
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    msg.role === 'assistant'
                      ? 'bg-blue-600/30 border border-blue-500/40'
                      : 'bg-slate-600/50 border border-slate-500/40'
                  }`}>
                    {msg.role === 'assistant'
                      ? <Bot size={16} className="text-blue-300" />
                      : <User size={16} className="text-slate-200" />
                    }
                  </div>

                  <div className={`max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? 'rounded-tl-none'
                      : 'rounded-tr-none'
                  }`}
                    style={msg.role === 'assistant' ? {
                      background: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#e2e8f0'
                    } : {
                      background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      color: '#ffffff'
                    }}
                  >
                    <div className="prose prose-sm max-w-none [&_p]:text-inherit [&_strong]:text-white [&_strong]:font-bold [&_li]:text-inherit [&_ol]:text-inherit [&_ul]:text-inherit">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-blue-300" />
                  </div>
                  <div
                    className="p-4 rounded-2xl rounded-tl-none"
                    style={{
                      background: 'rgba(30, 41, 59, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    <Loader2 size={18} className="animate-spin text-blue-400" />
                  </div>
                </div>
              )}
            </div>

            <div
              className="p-5 shrink-0"
              style={{
                background: 'rgba(15, 23, 42, 0.95)',
                borderTop: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                {messages.length === 1
                  ? (lang === 'ru' ? 'Выберите вопрос:' : lang === 'en' ? 'Choose a question:' : 'Savol tanlang:')
                  : (lang === 'ru' ? 'Другие вопросы:' : lang === 'en' ? 'Other questions:' : 'Boshqa savollar:')}
              </p>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {questions.map((q) => (
                  <button
                    key={q.key}
                    onClick={() => handleQuestionClick(q.text)}
                    disabled={loading}
                    className="flex flex-col items-center gap-2 p-3 rounded-xl text-xs font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed group hover:bg-slate-700/90 hover:border-white/20"
                    style={{
                      background: 'rgba(30, 41, 59, 0.8)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#cbd5e1'
                    }}
                  >
                    <div className={`w-8 h-8 rounded-lg ${q.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                      <q.icon size={16} className={q.iconColor} />
                    </div>
                    <span className="text-center leading-tight">{q.label}</span>
                  </button>
                ))}
              </div>
              
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={lang === 'ru' ? 'Напишите сообщение...' : lang === 'en' ? 'Type a message...' : 'Xabar yozing...'}
                  disabled={loading}
                  className="w-full px-4 py-3 pr-12 rounded-xl text-sm transition-all disabled:opacity-50 outline-none"
                  style={{
                    background: 'rgba(30, 41, 59, 0.8)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#e2e8f0'
                  }}
                />
                <button
                  type="submit"
                  disabled={loading || !inputMessage.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-all disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff'
                  }}
                >
                  <Send size={16} />
                </button>
              </form>
              
              <p className="text-[9px] text-center text-slate-600 mt-3 font-medium uppercase tracking-widest">
                {t('chat.ai_disclaimer')}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
