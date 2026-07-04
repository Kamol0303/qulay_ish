import { debugLogger } from '../lib/debugLogger';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc } from 'firebase/firestore';
import { ChatMessage, Profile } from '../types';
import { Send, ChevronLeft, Phone, MessageSquare, Check, CheckCheck, AlertCircle } from 'lucide-react';
import Layout from '../components/Layout';
import { useAuth } from '../hooks/useAuth';
import { moderationService } from '../services/moderationService';
import { relationshipService } from '../services/relationshipService';

export default function ChatPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get('with');
  
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputText, setInputText] = React.useState('');
  const [chatPartner, setChatPartner] = React.useState<Profile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isTyping, setIsTyping] = React.useState(false);
  const [moderationError, setModerationError] = React.useState<string | null>(null);
  const [isBlocked, setIsBlocked] = React.useState(false);
  const [canViewPhone, setCanViewPhone] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const typingTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    debugLogger.log('ChatPage mounted', { user: user?.uid, withUserId });
    
    if (!user) {
      debugLogger.log('No user, redirecting to auth');
      navigate('/auth');
      return;
    }

    if (!withUserId) {
      debugLogger.log('No withUserId');
      setLoading(false);
      return;
    }

    // Check if user is blocked
    const checkBlockStatus = async () => {
      const blocked = await moderationService.isUserBlocked(user.uid);
      setIsBlocked(blocked);
    };
    checkBlockStatus();

    // Fetch chat partner
    const fetchPartner = async () => {
      try {
        debugLogger.log('Fetching partner:', withUserId);
        const docSnap = await getDoc(doc(db, 'profiles', withUserId));
        if (docSnap.exists()) {
          const partnerData = docSnap.data() as Profile;
          debugLogger.log('Partner found:', partnerData);
          setChatPartner(partnerData);
          // check contact visibility
          if (user) {
            const ok = await relationshipService.canViewContact(user.uid, partnerData.uid);
            setCanViewPhone(!!ok);
          }
        } else {
          debugLogger.log('Partner not found');
        }
      } catch (err) {
        debugLogger.error('Error fetching partner:', err);
      }
    };
    fetchPartner();

    // Listen to messages
    debugLogger.log('Setting up message listener');
    const q = query(
      collection(db, 'chat_messages'),
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        debugLogger.log('Messages snapshot received:', { size: snapshot.size });
        const allMsgs = snapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        } as ChatMessage));
        
        debugLogger.log('All messages:', allMsgs);
        
        const filteredMsgs = allMsgs
          .filter(m => 
            (m.senderId === user.uid && m.receiverId === withUserId) || 
            (m.senderId === withUserId && m.receiverId === user.uid)
          )
          .sort((a, b) => {
            const timeA = a.createdAt?.seconds || 0;
            const timeB = b.createdAt?.seconds || 0;
            return timeA - timeB;
          });
        
        debugLogger.log('Filtered messages:', filteredMsgs);
        setMessages(filteredMsgs);
        setLoading(false);
        
        setTimeout(() => {
          scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      },
      (err) => {
        debugLogger.error('Message listener error:', err);
        setLoading(false);
      }
    );

    return () => {
      debugLogger.log('Cleaning up message listener');
      unsubscribe();
    };
  }, [user, withUserId, navigate]);

  const handleTyping = () => {
    setIsTyping(true);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !user || !withUserId) {
      debugLogger.log('Cannot send:', { inputText, user: user?.uid, withUserId });
      return;
    }

    // Check if user is blocked
    if (isBlocked) {
      setModerationError('Siz vaqtincha bloklangansiz. Iltimos, keyinroq urinib ko\'ring.');
      return;
    }

    const text = inputText;
    setInputText('');
    setModerationError(null);

    try {
      // AI Moderation check
      debugLogger.log('Moderating message:', text);
      const moderationResult = await moderationService.moderateMessage(user.uid, text);
      
      if (!moderationResult.isAllowed) {
        setModerationError(moderationResult.reason || 'Xabar yuborishda xatolik');
        setInputText(text);
        return;
      }

      if (moderationResult.suggestedAction === 'warn') {
        setModerationError(moderationResult.reason || '');
        setTimeout(() => setModerationError(null), 3000);
      }

      debugLogger.log('Sending message:', { text, from: user.uid, to: withUserId });
      await addDoc(collection(db, 'chat_messages'), {
        senderId: user.uid,
        receiverId: withUserId,
        text,
        participants: [user.uid, withUserId],
        read: false,
        delivered: false,
        status: 'sent',
        createdAt: serverTimestamp()
      });
      debugLogger.log('Message sent successfully');
    } catch (error) {
      debugLogger.error('Send error:', error);
      setInputText(text);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="bg-white rounded-3xl p-8 text-center">
            <p className="text-gray-600">{t('common.loading')}...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (!withUserId) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto px-4 py-8 h-[calc(100vh-120px)] flex flex-col">
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-[40px] border border-gray-100 shadow-xl p-12 text-center">
            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-6">
              <MessageSquare size={40} />
            </div>
            <h2 className="text-2xl font-black text-gray-900 mb-2">{t('chat.title')}</h2>
            <p className="text-gray-500 max-w-xs">{t('chat.no_chat_selected')}</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[calc(100vh-120px)] flex flex-col">
        <div className="flex-1 flex flex-col bg-white rounded-[40px] border border-gray-100 shadow-2xl overflow-hidden">
          {/* Chat Header */}
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between bg-white">
            <div className="flex items-center space-x-4">
              <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-50 rounded-full text-gray-400">
                <ChevronLeft size={24} />
              </button>
              <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={chatPartner?.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(chatPartner?.fullName || 'User')}&background=random`}
                  alt="Partner"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">{chatPartner?.fullName || 'Foydalanuvchi'}</h3>
                <div className="flex items-center text-[10px] text-green-500 font-bold uppercase">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></div>
                  {t('chat.online')}
                </div>
              </div>
            </div>
            {canViewPhone && chatPartner?.phoneNumber && (
              <a href={`tel:${chatPartner.phoneNumber}`} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full">
                <Phone size={20} />
              </a>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <MessageSquare size={48} className="text-gray-300 mb-4" />
                <p className="text-sm font-bold text-gray-400 uppercase mb-2">{t('chat.no_messages')}</p>
                <p className="text-xs text-gray-400">{t('chat.say_hello')}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.senderId === user?.uid;
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-5 py-3 rounded-3xl shadow-sm ${
                      isMe 
                        ? 'bg-blue-100 text-gray-900 border border-blue-200 rounded-tr-none' 
                        : 'bg-white text-gray-900 border border-gray-200 rounded-tl-none'
                    }`}>
                      <p className="text-sm leading-relaxed text-gray-900">{msg.text}</p>
                      <div className="flex items-center justify-between mt-1">
                        {msg.createdAt && (
                          <div className="text-[9px] font-bold uppercase text-gray-500">
                            {new Date(msg.createdAt.seconds * 1000).toLocaleTimeString('uz-UZ', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </div>
                        )}
                        {isMe && (
                          <div className="ml-2">
                            {msg.read ? (
                              <CheckCheck size={14} className="text-blue-500" />
                            ) : msg.delivered ? (
                              <CheckCheck size={14} className="text-gray-400" />
                            ) : (
                              <Check size={14} className="text-gray-400" />
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

          {/* Input Area */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-gray-50">
            {moderationError && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-red-700 text-sm">
                <AlertCircle size={16} />
                <span>{moderationError}</span>
              </div>
            )}
            {isBlocked && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-yellow-700 text-sm text-center font-bold">
                Siz vaqtincha bloklangansiz. Qoidalarni buzganlik uchun 24 soat xabar yozish taqiqlangan.
              </div>
            )}
            <div className="flex items-center space-x-3 bg-gray-50 rounded-2xl p-2 border border-gray-100 focus-within:border-blue-200 focus-within:ring-2 focus-within:ring-blue-50">
              <input
                type="text"
                value={inputText}
                onChange={(e) => {
                  setInputText(e.target.value);
                  handleTyping();
                }}
                placeholder={t('chat.placeholder')}
                disabled={isBlocked}
                className="flex-1 bg-transparent border-none focus:ring-0 outline-none px-3 py-2 text-sm disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isBlocked}
                className="bg-blue-500 text-white p-3 rounded-xl hover:bg-blue-600 transition-all shadow-lg disabled:opacity-50 disabled:shadow-none"
              >
                <Send size={18} />
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
