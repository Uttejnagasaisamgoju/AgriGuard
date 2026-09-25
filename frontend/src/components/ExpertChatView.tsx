import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft, Send, Paperclip, Star, CheckCircle, Mic,
  User, RefreshCw, MessageSquare, AlertCircle
} from 'lucide-react';
import { chatApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { ExpertProfile, ChatMessage } from '../types';

interface ExpertChatViewProps {
  onBack: () => void;
  conversationIdProp?: string;
}

interface DisplayMessage {
  id: string;
  sender: 'me' | 'other';
  senderName?: string;
  text: string;
  time: string;
}

export const ExpertChatView: React.FC<ExpertChatViewProps> = ({ onBack, conversationIdProp }) => {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();

  type ChatState = 'NOT_LOADED' | 'LOADING' | 'LOADED_EMPTY' | 'LOADED_WITH_MESSAGES' | 'ERROR';
  const [chatState, setChatState] = useState<ChatState>('NOT_LOADED');

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  const [expert, setExpert] = useState<ExpertProfile | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>('Agricultural Consultant');
  const [conversationId, setConversationId] = useState<string | null>(conversationIdProp || null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<any>(null);

  const isExpertUser = user?.role === 'EXPERT';

  useEffect(() => {
    initChat();
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [user?.id, conversationIdProp]);

  const initChat = async () => {
    setChatState('LOADING');
    setSendError(null);
    try {
      // 1. First attempt to restore the user's active conversation
      const activeRes = await chatApi.getActiveConversation();
      if (activeRes?.conversation && !conversationIdProp) {
        const c = activeRes.conversation;
        setConversationId(c.id);
        if (c.other_user?.name) {
          setOtherUserName(c.other_user.name);
        }
        if (c.messages && c.messages.length > 0) {
          const mapped: DisplayMessage[] = c.messages.map((m: any) => ({
            id: m.id,
            sender: m.sender_id === user?.id ? 'me' : 'other',
            senderName: m.sender_name,
            text: m.content,
            time: formatTime(m.created_at || ''),
          }));
          setMessages(mapped);
          setChatState('LOADED_WITH_MESSAGES');
        } else {
          setMessages([]);
          setChatState('LOADED_EMPTY');
        }

        // Fetch conversations list in parallel for switcher
        chatApi.getConversations().then((res) => {
          setConversations(res.conversations || []);
        }).catch((e) => console.warn('Could not list conversations:', e));

        return;
      }

      // 2. Fallback: list all available conversations
      const convRes = await chatApi.getConversations();
      const convList = convRes.conversations || [];
      setConversations(convList);

      let targetConvId = conversationIdProp;

      if (!targetConvId && convList.length > 0) {
        targetConvId = convList[0].id;
        if (convList[0].other_user?.name) {
          setOtherUserName(convList[0].other_user.name);
        }
      }

      // If user has no conversation yet and is not an expert, initiate with the first expert
      if (!targetConvId && !isExpertUser) {
        const expRes = await chatApi.getExperts();
        if (expRes.experts && expRes.experts.length > 0) {
          const firstExp = expRes.experts[0];
          setExpert(firstExp);
          setOtherUserName(firstExp.name);
          const startRes = await chatApi.startConversation(firstExp.id);
          targetConvId = startRes.conversation_id;
        }
      }

      if (targetConvId) {
        setConversationId(targetConvId);
        await loadMessages(targetConvId);
      } else {
        setChatState('LOADED_EMPTY');
      }
    } catch (err) {
      console.error('Failed to initialize consultation chat:', err);
      setChatState('ERROR');
    }
  };

  const loadMessages = async (convId: string, silent = false) => {
    try {
      const msgRes = await chatApi.getMessages(convId);
      if (msgRes.messages) {
        const mapped: DisplayMessage[] = msgRes.messages.map((m: ChatMessage) => ({
          id: m.id,
          sender: m.sender_id === user?.id ? 'me' : 'other',
          senderName: m.sender_name,
          text: m.content,
          time: formatTime(m.created_at || ''),
        }));
        setMessages(mapped);
        if (mapped.length > 0) {
          setChatState('LOADED_WITH_MESSAGES');
        } else {
          setChatState('LOADED_EMPTY');
        }
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
      if (!silent) {
        setChatState('ERROR');
      }
    }
  };

  // Background polling for new messages every 3.5 seconds without wiping state
  useEffect(() => {
    if (!conversationId) return;

    pollTimerRef.current = setInterval(() => {
      loadMessages(conversationId, true);
    }, 3500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [conversationId, user?.id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, chatState]);

  const handleSend = async () => {
    if (!inputVal.trim() || !conversationId) return;
    const text = inputVal.trim();
    setInputVal('');
    setSendError(null);

    const now = new Date();
    const timeStr = formatTime(now.toISOString());

    // Optimistic message update
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg: DisplayMessage = {
      id: tempId,
      sender: 'me',
      text,
      time: timeStr,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setChatState('LOADED_WITH_MESSAGES');

    setIsSending(true);
    try {
      await chatApi.sendMessage(conversationId, text);
      await loadMessages(conversationId, true);
    } catch (err: any) {
      console.error('Failed to deliver message:', err);
      // Remove optimistic message if server rejected to avoid fake persistence
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setSendError(t('chat.sendFailed') || 'Message could not be sent. Please check your connection and try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  function formatTime(dateStr?: string): string {
    if (!dateStr) return t('chat.justNow') || 'Just now';
    try {
      const d = new Date(dateStr);
      return formatDate(d, { hour: '2-digit', minute: '2-digit' });
    } catch {
      return t('chat.recently') || 'Recently';
    }
  }

  return (
    <div
      className="space-y-4 animate-fade-in-up flex flex-col"
      style={{ height: 'calc(100dvh - 130px)', minHeight: 520 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white font-heading">
              {isExpertUser
                ? (t('chat.consultationConsole') || 'Consultation Console')
                : (t('chat.expertConsultation') || 'Expert Consultation')}
            </h1>
            <p className="text-emerald-300/70 text-xs mt-0.5">
              {t('chat.directEncryptedChannel') || 'Direct encrypted advisory channel'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {conversations.length > 1 && (
            <select
              value={conversationId || ''}
              onChange={(e) => {
                setConversationId(e.target.value);
                loadMessages(e.target.value);
              }}
              className="glass-input text-xs py-1 px-3 bg-[#06241b] border-emerald-500/30 text-white rounded-xl"
            >
              {conversations.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0a1f18]">
                  {c.other_user?.name || 'Chat'} {c.unread_count > 0 ? `(${c.unread_count} new)` : ''}
                </option>
              ))}
            </select>
          )}

          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{t('common.active') || 'Active'}</span>
          </div>
        </div>
      </div>

      {/* Target User / Expert Profile Card */}
      <div className="glass-card p-3.5 flex items-center gap-3.5 flex-shrink-0 border border-emerald-500/20">
        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-emerald-400/50 flex-shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.3)] bg-emerald-950 flex items-center justify-center">
          {isExpertUser ? (
            <User className="w-6 h-6 text-emerald-400" />
          ) : (
            <img
              src="/expert_dr_ramesh.jpg"
              alt="Dr. Ramesh Kumar"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
              }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-black text-white truncate">
              {otherUserName}
            </h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
              <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
              {isExpertUser
                ? (t('chat.verifiedFarmer') || 'Verified Farmer')
                : (t('chat.verifiedAgronomist') || 'Verified Agronomist')}
            </span>
          </div>
          <p className="text-[11px] text-emerald-300/70 font-medium truncate">
            {isExpertUser
              ? 'Rice & Cotton Grower • Nizamabad, Telangana'
              : expert?.specialization || 'Crop Pathology & Soil Chemistry Specialist'}
          </p>
          {!isExpertUser && (
            <div className="flex items-center gap-2 mt-0.5 text-[11px]">
              <span className="flex items-center gap-1 text-amber-300 font-bold">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span>4.9</span>
              </span>
              <span className="text-emerald-300/50">
                {t('chat.consultationsCount', { count: 340 }) || '(340+ Consultations)'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Chat Messages Viewport */}
      <div
        className="glass-card p-4 flex-1 overflow-y-auto space-y-4 border border-emerald-500/20 min-h-0 touch-pan-y"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {chatState === 'LOADING' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
            <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-sm font-bold text-emerald-200">
              {t('chat.loadingConversation') || 'Loading conversation...'}
            </p>
            <p className="text-xs text-emerald-400/60">
              {t('chat.retrievingEncrypted') || 'Retrieving encrypted consultation history from server'}
            </p>
          </div>
        )}

        {chatState === 'ERROR' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 select-none">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">
                {t('chat.unableToLoad') || 'Unable to load previous messages'}
              </h3>
              <p className="text-xs text-red-300/70">
                {t('chat.checkConnection') || 'Please check your connection and try again.'}
              </p>
            </div>
            <button
              onClick={() => initChat()}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer mx-auto shadow-lg shadow-emerald-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('common.retry') || 'Retry'}</span>
            </button>
          </div>
        )}

        {chatState === 'LOADED_EMPTY' && (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-emerald-300/60 space-y-2 select-none">
            <MessageSquare className="w-10 h-10 text-emerald-400/40" />
            <p className="text-xs font-semibold text-emerald-200">
              {t('chat.noMessagesYet') || 'No consultation messages yet'}
            </p>
            <p className="text-[11px] text-emerald-400/50 max-w-sm">
              {isExpertUser
                ? (t('chat.noConsultationExpert') || 'Send your agronomic recommendation or advisory instructions to the farmer.')
                : (t('chat.noConsultationFarmer') || 'Ask a question regarding crop symptoms, fertilizer dosing, or pest management.')}
            </p>
          </div>
        )}

        {chatState === 'LOADED_WITH_MESSAGES' && messages.map((m) => {
          const isMe = m.sender === 'me';
          return (
            <div
              key={m.id}
              className={`flex items-end gap-2.5 ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              {!isMe && (
                <div className="w-7 h-7 rounded-full overflow-hidden border border-emerald-400/40 flex-shrink-0 mb-4 bg-emerald-950 flex items-center justify-center">
                  {isExpertUser ? (
                    <User className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <img src="/expert_dr_ramesh.jpg" alt="Doctor" className="w-full h-full object-cover" />
                  )}
                </div>
              )}

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%] sm:max-w-[70%]`}>
                <div
                  className={`p-3.5 text-xs leading-relaxed rounded-2xl ${
                    isMe
                      ? 'bg-emerald-500 text-emerald-950 font-bold rounded-br-none shadow-[0_4px_15px_rgba(16,185,129,0.3)]'
                      : 'bg-[#06241b]/95 border border-emerald-500/25 text-emerald-100 rounded-bl-none shadow-md backdrop-blur-md'
                  }`}
                >
                  {m.text}
                </div>
                <span className="text-[10px] text-emerald-300/50 mt-1 px-1">{m.time}</span>
              </div>
            </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Send Error Notice */}
      {sendError && (
        <div className="px-3.5 py-2 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center justify-between animate-fade-in flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{sendError}</span>
          </div>
          <button
            onClick={() => setSendError(null)}
            className="text-red-300 hover:text-white text-xs font-bold underline cursor-pointer"
          >
            {t('chat.dismiss') || 'Dismiss'}
          </button>
        </div>
      )}

      {/* Bottom Message Input Bar */}
      <div className="glass-card p-2.5 flex items-center gap-2 border border-emerald-500/20 flex-shrink-0">
        <input
          type="text"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isExpertUser
              ? (t('chat.typeRecommendation') || 'Type clinical recommendation or prescription...')
              : (t('chat.askAgronomist') || 'Ask an agronomist a question...')
          }
          className="glass-input flex-1 py-2 text-xs border border-emerald-500/20 bg-transparent"
        />

        <button
          onClick={handleSend}
          disabled={!inputVal.trim() || isSending || !conversationId}
          className="w-9 h-9 rounded-xl bg-emerald-500 text-emerald-950 flex items-center justify-center hover:bg-emerald-400 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_12px_rgba(16,185,129,0.4)]"
          title={t('chat.send') || 'Send message'}
        >
          <Send className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
};

function formatTime(dateStr?: string): string {
  if (!dateStr) return 'Just now';
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Recently';
  }
}
