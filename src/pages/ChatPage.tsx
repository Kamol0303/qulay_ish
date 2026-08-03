import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { ChatMessage, ChatThread, Profile } from '../types';
import { Send, ChevronLeft, Phone, MessageSquare, Check, CheckCheck, AlertCircle, Shield, User } from 'lucide-react';
import Layout from '../components/Layout';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../hooks/useAuth';
import { moderationService } from '../services/moderationService';
import { relationshipService } from '../services/relationshipService';
import { toJsDate } from '../lib/utils';

function messageBody(msg: ChatMessage) {
  return msg.content || msg.text || msg.message || '';
}

export default function ChatPage() {
  const { t } = useTranslation();
  const { user, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get('with');
  const navigate = useNavigate();

  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [threads, setThreads] = React.useState<ChatThread[]>([]);
  const [inputText, setInputText] = React.useState('');
  const [chatPartner, setChatPartner] = React.useState<Profile | null>(null);
  const [superAdminId, setSuperAdminId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [moderationError, setModerationError] = React.useState<string | null>(null);
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [canViewPhone, setCanViewPhone] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const isDashboardUser = Boolean(profile?.role);
  const chatBase =
    profile?.role === 'super_admin' ? '/super-admin/messages' : '/chat';

  const Shell = ({ children }: { children: React.ReactNode }) =>
    isDashboardUser ? <DashboardLayout>{children}</DashboardLayout> : <Layout>{children}</Layout>;

  React.useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    void moderationService.isUserBlocked(user.uid).then(setIsBlocked);

    // Resolve Super Admin id so workers/employers can message support
    void api.users
      .list({ role: 'super_admin' })
      .then((rows) => setSuperAdminId(rows[0]?.uid || null))
      .catch(() => setSuperAdminId(null));

    if (!withUserId) {
      const loadInbox = async () => {
        try {
          const inbox = await api.chatMessages.inbox();
          setThreads(inbox);
        } catch (err) {
          debugLogger.error('Inbox load error:', err);
        } finally {
          setLoading(false);
        }
      };
      loadInbox();
      const interval = setInterval(loadInbox, 5000);
      return () => clearInterval(interval);
    }

    const fetchPartner = async () => {
      try {
        const partnerData = await api.users.get(withUserId);
        setChatPartner(partnerData);
        const ok = await relationshipService.canViewContact(user.uid, partnerData.uid);
        setCanViewPhone(!!ok || profile?.role === 'super_admin');
      } catch (err) {
        debugLogger.error('Error fetching partner:', err);
      }
    };
    void fetchPartner();

    const loadMessages = async () => {
      try {
        const allMsgs = await api.chatMessages.list(user.uid, withUserId);
        setMessages(
          allMsgs.sort((a, b) => {
            const timeA = toJsDate(a.createdAt)?.getTime() || 0;
            const timeB = toJsDate(b.createdAt)?.getTime() || 0;
            return timeA - timeB;
          }),
        );
        // Mark inbound unread as read
        for (const msg of allMsgs) {
          if (msg.receiverId === user.uid && !msg.read && msg.id) {
            void api.chatMessages.update(msg.id, { read: true, status: 'read' }).catch(() => undefined);
          }
        }
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      } catch (err) {
        debugLogger.error('Message load error:', err);
        setLoading(false);
      }
    };

    void loadMessages();
    const interval = setInterval(loadMessages, 4000);
    return () => clearInterval(interval);
  }, [user, withUserId, navigate, profile?.role]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !withUserId) return;
    if (isBlocked) {
      setModerationError('Siz vaqtincha bloklangansiz. Iltimos, keyinroq urinib ko\'ring.');
      return;
    }

    const text = inputText;
    setInputText('');
    setModerationError(null);

    try {
      const moderationResult = await moderationService.moderateMessage(user.uid, text);
      if (!moderationResult.isAllowed) {
        setModerationError(moderationResult.reason || 'Xabar yuborishda xatolik');
        setInputText(text);
        return;
      }

      const created = await api.chatMessages.create({
        senderId: user.uid,
        receiverId: withUserId,
        text,
        read: false,
        delivered: true,
        status: 'sent',
      });
      setMessages((prev) => [...prev, created]);
      setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (error) {
      debugLogger.error('Send error:', error);
      setInputText(text);
      setModerationError(error instanceof Error ? error.message : 'Yuborib bo\'lmadi');
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="rounded-3xl bg-card p-8 text-center text-muted-foreground">{t('common.loading')}...</div>
      </Shell>
    );
  }

  if (!withUserId) {
    return (
      <Shell>
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">{t('chat.title')}</h2>
            <p className="mt-1 text-muted-foreground">Suhbatlarni tanlang yoki yangisini boshlang</p>
          </div>

          {profile?.role !== 'super_admin' && superAdminId && (
            <button
              type="button"
              onClick={() => navigate(`${chatBase}?with=${superAdminId}`)}
              className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4 text-left hover:bg-primary/10"
            >
              <div className="rounded-xl bg-primary/15 p-3 text-primary">
                <Shield size={22} />
              </div>
              <div>
                <p className="font-bold">Super Admin ga yozish</p>
                <p className="text-sm text-muted-foreground">Yordam, shikoyat yoki savol</p>
              </div>
            </button>
          )}

          {profile?.role === 'super_admin' && (
            <Link
              to="/super-admin/users"
              className="rounded-2xl border border-border bg-card px-5 py-4 text-sm font-bold text-primary hover:bg-secondary"
            >
              Foydalanuvchilar ro‘yxatidan suhbatni ochish →
            </Link>
          )}

          {threads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-[40px] border border-border bg-card p-12 text-center shadow-sm">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MessageSquare size={40} />
              </div>
              <h3 className="mb-2 text-2xl font-black">{t('chat.title')}</h3>
              <p className="max-w-sm text-muted-foreground">{t('chat.no_chat_selected')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {threads.map((thread) => (
                <button
                  key={thread.peerId}
                  type="button"
                  onClick={() => navigate(`${chatBase}?with=${thread.peerId}`)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                    {thread.peerPhotoUrl ? (
                      <img src={thread.peerPhotoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <User className="text-muted-foreground" size={22} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-bold">{thread.peerName}</p>
                      {thread.lastAt && (
                        <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                          {toJsDate(thread.lastAt)?.toLocaleDateString('uz-UZ')}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{thread.lastMessage}</p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {thread.peerRole}
                    </p>
                  </div>
                  {(thread.unreadCount || 0) > 0 && (
                    <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
                      {thread.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto flex h-[calc(100vh-180px)] max-w-4xl flex-col">
        <div className="flex flex-1 flex-col overflow-hidden rounded-[40px] border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => navigate(chatBase)}
                className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
              >
                <ChevronLeft size={24} />
              </button>
              <div className="h-10 w-10 overflow-hidden rounded-xl bg-secondary">
                <img
                  src={
                    chatPartner?.photoUrl ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(chatPartner?.fullName || 'User')}&background=random`
                  }
                  alt="Partner"
                  className="h-full w-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-bold">{chatPartner?.fullName || 'Foydalanuvchi'}</h3>
                <div className="flex items-center text-[10px] font-bold uppercase text-green-500">
                  <div className="mr-1.5 h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                  {chatPartner?.role || t('chat.online')}
                </div>
              </div>
            </div>
            {canViewPhone && chatPartner?.phoneNumber && (
              <a href={`tel:${chatPartner.phoneNumber}`} className="rounded-full p-2 text-blue-600 hover:bg-blue-50">
                <Phone size={20} />
              </a>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-secondary/30 p-6">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <MessageSquare size={48} className="mb-4 text-muted-foreground/40" />
                <p className="mb-2 text-sm font-bold uppercase text-muted-foreground">{t('chat.no_messages')}</p>
                <p className="text-xs text-muted-foreground">{t('chat.say_hello')}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-3xl px-5 py-3 shadow-sm ${
                        isMe
                          ? 'rounded-tr-none border border-blue-200 bg-blue-100'
                          : 'rounded-tl-none border border-border bg-card'
                      }`}
                    >
                      <p className="text-sm leading-relaxed text-foreground">{messageBody(msg)}</p>
                      <div className="mt-1 flex items-center justify-between">
                        {msg.createdAt && (
                          <div className="text-[9px] font-bold uppercase text-muted-foreground">
                            {toJsDate(msg.createdAt)?.toLocaleTimeString('uz-UZ', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        )}
                        {isMe && (
                          <div className="ml-2">
                            {msg.read ? (
                              <CheckCheck size={14} className="text-blue-500" />
                            ) : (
                              <Check size={14} className="text-muted-foreground" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={scrollRef} />
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-border bg-card p-4">
            {moderationError && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} />
                <span>{moderationError}</span>
              </div>
            )}
            {isBlocked && (
              <div className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center text-sm font-bold text-yellow-700">
                Siz vaqtincha bloklangansiz.
              </div>
            )}
            <div className="flex items-center space-x-3 rounded-2xl border border-border bg-secondary/40 p-2 focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t('chat.placeholder')}
                disabled={isBlocked}
                className="flex-1 border-none bg-transparent px-3 py-2 text-sm outline-none focus:ring-0 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isBlocked}
                className="rounded-xl bg-blue-500 p-3 text-white shadow-lg transition-all hover:bg-blue-600 disabled:opacity-50 disabled:shadow-none"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </Shell>
  );
}
