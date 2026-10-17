import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { ChatMessage, ChatThread } from '../../types';
import ChatComposer from '../../components/chat/ChatComposer';
import MobileCard from '../components/Card';
import { SkeletonList } from '../components/SkeletonCard';
import PullToRefresh from '../components/PullToRefresh';
import { hapticLight } from '../haptics';

export default function ChatMobile() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const withId = searchParams.get('with');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [peerName, setPeerName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadInbox = async () => {
    setLoading(true);
    try {
      const rows = await api.chatMessages.inbox();
      setThreads(rows);
    } catch {
      setThreads([]);
    } finally {
      setLoading(false);
    }
  };

  const loadThread = async (otherId: string) => {
    if (!profile?.uid) return;
    const rows = await api.chatMessages.list(profile.uid, otherId);
    setMessages(rows);
  };

  useEffect(() => {
    void loadInbox();
    const id = setInterval(() => void loadInbox(), 8000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile?.uid) return;
    if (!withId || withId === profile.uid) {
      setActiveId(null);
      if (withId && withId === profile.uid) setSearchParams({}, { replace: true });
      return;
    }
    setActiveId(withId);
    setSendError(null);
  }, [withId, profile?.uid, setSearchParams]);

  useEffect(() => {
    if (!activeId) return;
    void loadThread(activeId);
    const id = setInterval(() => void loadThread(activeId), 5000);
    return () => clearInterval(id);
  }, [activeId, profile?.uid]);

  useEffect(() => {
    if (!activeId) return;
    const known = threads.find((t) => t.peerId === activeId)?.peerName;
    if (known) {
      setPeerName(known);
      return;
    }
    let cancelled = false;
    void api.users.get(activeId).then((user) => {
      if (!cancelled) setPeerName(user.fullName || 'Chat');
    }).catch(() => {
      if (!cancelled) setPeerName('Chat');
    });
    return () => {
      cancelled = true;
    };
  }, [activeId, threads]);

  const closeThread = () => {
    void hapticLight();
    setActiveId(null);
    setMessages([]);
    setSendError(null);
    setSearchParams({}, { replace: true });
  };

  if (activeId) {
    const peer = threads.find((t) => t.peerId === activeId);
    return (
      <div className="flex flex-col h-[calc(100dvh-52px-env(safe-area-inset-top))]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card">
          <button
            type="button"
            className="min-h-[44px] min-w-[44px] font-bold text-primary"
            onClick={closeThread}
          >
            ←
          </button>
          <h1 className="font-bold truncate">{peer?.peerName || peerName || 'Chat'}</h1>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2 bg-secondary/30">
          {messages.length === 0 && (
            <p className="pt-16 text-center text-sm text-muted-foreground">Birinchi xabarni shu yerga yozing</p>
          )}
          {messages.map((m) => {
            const mine = m.senderId === profile?.uid;
            const body = m.content || m.text || m.message || '';
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'
                  }`}
                >
                  {body}
                </div>
              </div>
            );
          })}
        </div>
        <div className="border-t border-border bg-card p-2 pb-[env(safe-area-inset-bottom)]">
          <ChatComposer
            placeholder="Xabar yozing..."
            moderationError={sendError}
            onSend={async (text) => {
              if (!profile?.uid || !activeId) return;
              setSendError(null);
              try {
                await api.chatMessages.create({
                  senderId: profile.uid,
                  receiverId: activeId,
                  content: text,
                });
                await loadThread(activeId);
                void loadInbox();
              } catch (err) {
                setSendError(err instanceof Error ? err.message : 'Xabar yuborilmadi');
                throw err;
              }
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 space-y-4">
      <h1 className="text-xl font-black">Chat</h1>
      <PullToRefresh onRefresh={loadInbox}>
        {loading ? (
          <SkeletonList />
        ) : threads.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageSquare className="mx-auto mb-3 opacity-40" size={40} />
            <p className="text-sm">Hali suhbat yo‘q</p>
          </div>
        ) : (
          <div className="space-y-2">
            {threads.map((t) => (
              <MobileCard
                key={t.peerId}
                onClick={() => {
                  void hapticLight();
                  setSearchParams({ with: t.peerId });
                }}
              >
                <p className="font-bold text-sm">{t.peerName || 'Foydalanuvchi'}</p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {t.lastMessage || 'Suhbatni ochish'}
                </p>
              </MobileCard>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
