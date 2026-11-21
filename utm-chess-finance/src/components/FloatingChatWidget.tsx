'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  supabase,
  UserProfile,
  ChatDirectoryMember,
  ChatMessageItem,
} from '@/lib/supabase';
import { waLink } from '@/lib/whatsapp';
import {
  MessageCircle,
  X,
  Search,
  Send,
  Smile,
  ArrowLeft,
  Loader2,
  Users,
  Crown,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

interface FloatingChatWidgetProps {
  profile: UserProfile;
  departments: string[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
}

interface RoomSummary {
  id: string;
  dm_key: string;
  last_message_text: string;
  last_message_sender_id: string | null;
  last_message_at: string;
  my_last_read_at: string;
  counterpartId: string | null;
  counterpart?: ChatDirectoryMember;
  hasUnread: boolean;
}

const PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 1000;
const QUICK_EMOJIS = [
  '👋', '♟️', '🏆', '👍', '🙏', '😊', '😂', '🔥',
  '🎉', '✅', '⏰', '📍', '🚗', '🧾', '💬', '👏',
  '🤩', '🤔', '👀', '💯', '🙌', '❤️', '👌', '📌',
];

function formatShortTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function roleLabel(role?: string): 'Owner' | 'Admin' | 'Member' {
  if (role === 'owner') return 'Owner';
  if (role === 'treasurer') return 'Admin';
  return 'Member';
}

function AvatarCircle({ name, role }: { name: string; role?: string }) {
  const initials = (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
  const bg =
    role === 'owner'
      ? 'bg-amber-400 text-slate-950'
      : role === 'treasurer'
      ? 'bg-emerald-600 text-white'
      : 'bg-slate-200 text-slate-700';
  return (
    <div
      className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${bg}`}
    >
      {initials || '?'}
    </div>
  );
}

export default function FloatingChatWidget({
  profile,
  departments,
  isOpen,
  onToggleOpen,
  unreadCount,
  onUnreadCountChange,
}: FloatingChatWidgetProps) {
  const [viewTab, setViewTab] = useState<'chats' | 'directory'>('chats');
  const [directory, setDirectory] = useState<ChatDirectoryMember[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);

  // Directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'HIGH_COM'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Active conversation
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<ChatDirectoryMember | null>(null);
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [msgDraft, setMsgDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [openingWa, setOpeningWa] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_unread_chat_count');
    if (!error && typeof data === 'number') {
      onUnreadCountChange(data);
    }
  }, [onUnreadCountChange]);

  const loadDirectoryAndRooms = useCallback(async () => {
    setLoadingList(true);
    setChatError(null);
    try {
      const [dirRes, myPartRes] = await Promise.all([
        supabase
          .from('users_public')
          .select(
            'id, full_name, matric_no, role, member_type, batch_year, member_status, allow_whatsapp_chat'
          )
          .order('full_name', { ascending: true }),
        supabase
          .from('chat_participants')
          .select('room_id, last_read_at')
          .eq('user_id', profile.id),
      ]);

      const dirList = ((dirRes.data || []) as ChatDirectoryMember[]).map((u) => ({
        ...u,
        member_type: u.member_type || 'Member',
        batch_year: u.batch_year || '',
        allow_whatsapp_chat: Boolean(u.allow_whatsapp_chat),
      }));
      setDirectory(dirList);
      const memberMap = new Map<string, ChatDirectoryMember>(dirList.map((u) => [u.id, u]));

      const myParts = (myPartRes.data || []) as { room_id: string; last_read_at: string }[];
      if (myParts.length === 0) {
        setRooms([]);
        onUnreadCountChange(0);
        return;
      }

      const roomIds = myParts.map((p) => p.room_id);
      const readMap = new Map(myParts.map((p) => [p.room_id, p.last_read_at]));

      const [roomsRes, allPartsRes] = await Promise.all([
        supabase
          .from('chat_rooms')
          .select('id, dm_key, last_message_text, last_message_sender_id, last_message_at')
          .in('id', roomIds)
          .order('last_message_at', { ascending: false }),
        supabase
          .from('chat_participants')
          .select('room_id, user_id')
          .in('room_id', roomIds),
      ]);

      const partsByRoom = new Map<string, string[]>();
      ((allPartsRes.data || []) as { room_id: string; user_id: string }[]).forEach((p) => {
        const arr = partsByRoom.get(p.room_id) || [];
        arr.push(p.user_id);
        partsByRoom.set(p.room_id, arr);
      });

      const builtRooms: RoomSummary[] = (
        (roomsRes.data || []) as {
          id: string;
          dm_key: string;
          last_message_text: string | null;
          last_message_sender_id: string | null;
          last_message_at: string | null;
        }[]
      ).map((r) => {
        const participantIds = partsByRoom.get(r.id) || r.dm_key.split(':');
        const otherId = participantIds.find((uid) => uid !== profile.id) || null;
        const myLastReadAt = readMap.get(r.id) || '';
        const lastMsgAt = r.last_message_at || '';
        const hasUnread = Boolean(
          r.last_message_sender_id &&
            r.last_message_sender_id !== profile.id &&
            lastMsgAt &&
            (!myLastReadAt || new Date(lastMsgAt).getTime() > new Date(myLastReadAt).getTime())
        );

        return {
          id: r.id,
          dm_key: r.dm_key,
          last_message_text: r.last_message_text || '',
          last_message_sender_id: r.last_message_sender_id,
          last_message_at: lastMsgAt,
          my_last_read_at: myLastReadAt,
          counterpartId: otherId,
          counterpart: otherId ? memberMap.get(otherId) : undefined,
          hasUnread,
        };
      });

      setRooms(builtRooms);
      onUnreadCountChange(builtRooms.filter((r) => r.hasUnread).length);
    } finally {
      setLoadingList(false);
    }
  }, [profile.id, onUnreadCountChange]);

  const markRoomRead = useCallback(
    async (roomId: string) => {
      await supabase
        .from('chat_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', profile.id);
      void refreshUnreadCount();
    },
    [profile.id, refreshUnreadCount]
  );

  // Load directory & rooms ONLY when widget opens
  useEffect(() => {
    if (isOpen) {
      void loadDirectoryAndRooms();
    } else {
      setEmojiOpen(false);
    }
  }, [isOpen, loadDirectoryAndRooms]);

  // Load latest 30 messages + open Realtime ONLY while widget is open & room active
  useEffect(() => {
    if (!isOpen || !activeRoomId) return;

    let cancelled = false;
    setLoadingMsgs(true);
    setChatError(null);
    setHasMoreMessages(false);

    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id, content, created_at')
        .eq('room_id', activeRoomId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (error) {
        setChatError(error.message || 'Could not load messages.');
        setLoadingMsgs(false);
        return;
      }

      const rows = (data || []) as ChatMessageItem[];
      setHasMoreMessages(rows.length === PAGE_SIZE);
      setMessages([...rows].reverse());
      setLoadingMsgs(false);
      void markRoomRead(activeRoomId);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 40);
    })();

    const channel = supabase
      .channel(`clubsync-chat-${activeRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeRoomId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessageItem;
          if (!incoming?.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.sender_id !== profile.id) {
            void markRoomRead(activeRoomId);
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isOpen, activeRoomId, profile.id, markRoomRead]);

  const handleLoadEarlier = async () => {
    if (!activeRoomId || messages.length === 0 || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const oldest = messages[0].created_at;
      const { data } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id, content, created_at')
        .eq('room_id', activeRoomId)
        .lt('created_at', oldest)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);
      const olderRows = (data || []) as ChatMessageItem[];
      setHasMoreMessages(olderRows.length === PAGE_SIZE);
      if (olderRows.length > 0) {
        setMessages((prev) => {
          const seen = new Set(prev.map((m) => m.id));
          const uniqueOlder = [...olderRows].reverse().filter((m) => !seen.has(m.id));
          return [...uniqueOlder, ...prev];
        });
      }
    } finally {
      setLoadingEarlier(false);
    }
  };

  const handleOpenMemberChat = async (member: ChatDirectoryMember) => {
    setChatError(null);
    const { data, error } = await supabase.rpc('get_or_create_dm_room', {
      target_user_id: member.id,
    });
    if (error || !data) {
      setChatError(error?.message || 'Could not start conversation.');
      return;
    }
    setActiveTarget(member);
    setActiveRoomId(String(data));
    setEmojiOpen(false);
  };

  const handleOpenExistingRoom = (room: RoomSummary) => {
    setChatError(null);
    setActiveTarget(
      room.counterpart || {
        id: room.counterpartId || '',
        full_name: 'Club Member',
        matric_no: '',
        role: 'member',
        member_type: 'Member',
        batch_year: '',
        allow_whatsapp_chat: false,
      }
    );
    setActiveRoomId(room.id);
    setEmojiOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoomId || sendingMsg) return;
    const trimmed = msgDraft.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

    setSendingMsg(true);
    setChatError(null);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: activeRoomId,
          sender_id: profile.id,
          content: trimmed,
        })
        .select('id, room_id, sender_id, content, created_at')
        .single();

      if (error) {
        setChatError(error.message || 'Could not send message.');
        return;
      }

      if (data) {
        const inserted = data as ChatMessageItem;
        setMessages((prev) =>
          prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
        );
      }
      setMsgDraft('');
      setEmojiOpen(false);
      void markRoomRead(activeRoomId);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleContinueOnWhatsApp = async () => {
    if (!activeTarget?.id || !activeTarget.allow_whatsapp_chat || openingWa) return;
    setOpeningWa(true);
    try {
      const { data } = await supabase.rpc('get_whatsapp_contact', {
        target_user_id: activeTarget.id,
      });
      if (data && typeof data === 'string') {
        const url = waLink(
          data,
          `Hi ${activeTarget.full_name}, continuing our ClubSync chat.`
        );
        if (url !== '#') {
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      } else {
        setChatError('WhatsApp handoff is unavailable for this member.');
      }
    } finally {
      setOpeningWa(false);
    }
  };

  const directoryMembers = directory.filter((m) => {
    if (m.id === profile.id) return false;
    if (roleFilter === 'HIGH_COM' && m.role !== 'owner' && m.role !== 'treasurer') {
      return false;
    }
    if (deptFilter !== 'ALL' && m.member_type !== deptFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const hay = `${m.full_name} ${m.matric_no} ${m.member_type}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {isOpen && (
        <div className="w-[360px] max-w-[calc(100vw-1.5rem)] h-[520px] max-h-[80vh] bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
          {activeRoomId && activeTarget ? (
            <>
              {/* Conversation Header (NO raw phone numbers or PII) */}
              <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRoomId(null);
                      setActiveTarget(null);
                      setMessages([]);
                      void loadDirectoryAndRooms();
                    }}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-200 cursor-pointer shrink-0"
                    aria-label="Back to chats"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <AvatarCircle name={activeTarget.full_name} role={activeTarget.role} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-extrabold truncate">
                        {activeTarget.full_name}
                      </span>
                      {activeTarget.role !== 'member' && (
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                            activeTarget.role === 'owner'
                              ? 'bg-amber-400 text-slate-950'
                              : 'bg-emerald-500 text-white'
                          }`}
                        >
                          {roleLabel(activeTarget.role)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300 truncate">
                      {activeTarget.matric_no ? `${activeTarget.matric_no} · ` : ''}
                      {activeTarget.member_type}
                      {activeTarget.batch_year ? ` · ${activeTarget.batch_year}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {activeTarget.allow_whatsapp_chat && (
                    <button
                      type="button"
                      disabled={openingWa}
                      onClick={() => void handleContinueOnWhatsApp()}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold cursor-pointer disabled:opacity-60"
                      title="Continue chat on WhatsApp"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onToggleOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                    aria-label="Close chat"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 bg-slate-50/70">
                {hasMoreMessages && (
                  <div className="text-center pb-1">
                    <button
                      type="button"
                      disabled={loadingEarlier}
                      onClick={() => void handleLoadEarlier()}
                      className="px-3 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-[11px] font-semibold text-slate-600 cursor-pointer"
                    >
                      {loadingEarlier ? 'Loading...' : 'Load earlier messages'}
                    </button>
                  </div>
                )}

                {loadingMsgs ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 px-6 space-y-1">
                    <MessageCircle className="w-7 h-7 text-slate-300" />
                    <p className="font-semibold text-slate-500">
                      Say hi to {activeTarget.full_name}!
                    </p>
                    <p className="text-[11px]">Text &amp; emoji messages only.</p>
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.sender_id === profile.id;
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] px-3 py-2 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap shadow-2xs ${
                            isMine
                              ? 'bg-emerald-600 text-white rounded-br-sm'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-[9px] text-slate-400 mt-0.5 px-1">
                          {formatShortTime(m.created_at)}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {chatError && (
                <div className="px-3 py-1.5 bg-rose-50 border-t border-rose-200 text-[11px] text-rose-700 font-semibold">
                  {chatError}
                </div>
              )}

              {/* Compact Emoji Picker Popover (above composer) */}
              {emojiOpen && (
                <div className="px-3 py-2 bg-white border-t border-slate-200 grid grid-cols-8 gap-1">
                  {QUICK_EMOJIS.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => {
                        setMsgDraft((prev) =>
                          prev.length + em.length <= MAX_MESSAGE_LENGTH ? `${prev}${em}` : prev
                        );
                        inputRef.current?.focus();
                      }}
                      className="h-8 rounded-lg hover:bg-slate-100 text-base flex items-center justify-center cursor-pointer"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}

              {/* Text & Emoji Only Composer (NO file inputs) */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 bg-white border-t border-slate-200 space-y-1 shrink-0"
              >
                {msgDraft.length >= 800 && (
                  <div className="text-right text-[10px] font-mono text-slate-500">
                    {msgDraft.length}/{MAX_MESSAGE_LENGTH}
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEmojiOpen((v) => !v)}
                    className={`p-2 rounded-xl border cursor-pointer transition ${
                      emojiOpen
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                    title="Emoji"
                  >
                    <Smile className="w-4 h-4" />
                  </button>
                  <input
                    ref={inputRef}
                    type="text"
                    maxLength={MAX_MESSAGE_LENGTH}
                    value={msgDraft}
                    onChange={(e) => setMsgDraft(e.target.value)}
                    placeholder="Type a message..."
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={sendingMsg || !msgDraft.trim()}
                    className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white cursor-pointer"
                    aria-label="Send message"
                  >
                    {sendingMsg ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Main List Header */}
              <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-extrabold">Club Chat</span>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                  aria-label="Close chat"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chats | Directory Tab Bar */}
              <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 text-xs font-bold shrink-0">
                <button
                  type="button"
                  onClick={() => setViewTab('chats')}
                  className={`py-2.5 border-b-2 cursor-pointer transition ${
                    viewTab === 'chats'
                      ? 'border-emerald-600 text-emerald-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Chats ({rooms.length})
                </button>
                <button
                  type="button"
                  onClick={() => setViewTab('directory')}
                  className={`py-2.5 border-b-2 cursor-pointer transition inline-flex items-center justify-center gap-1 ${
                    viewTab === 'directory'
                      ? 'border-emerald-600 text-emerald-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Directory ({Math.max(0, directory.length - 1)})</span>
                </button>
              </div>

              {viewTab === 'directory' && (
                <div className="p-3 border-b border-slate-200 space-y-2 bg-white shrink-0 text-xs">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, matric, department..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRoleFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        roleFilter === 'ALL'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setRoleFilter('HIGH_COM')}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                        roleFilter === 'HIGH_COM'
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Crown className="w-3 h-3" />
                      <span>High-Com</span>
                    </button>
                    <select
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                      className="flex-1 min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                    >
                      <option value="ALL">All Departments</option>
                      {departments.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {chatError && (
                <div className="px-3 py-2 bg-rose-50 border-b border-rose-200 text-[11px] text-rose-700 font-semibold">
                  {chatError}
                </div>
              )}

              {/* Body List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
                {loadingList ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  </div>
                ) : viewTab === 'chats' ? (
                  rooms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-xs text-slate-500">
                      <MessageCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-700">No conversations yet</p>
                      <p className="text-[11px] text-slate-400">
                        Find any member or High-Com officer in the Directory to start chatting.
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewTab('directory')}
                        className="mt-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Browse Directory
                      </button>
                    </div>
                  ) : (
                    rooms.map((room) => {
                      const other = room.counterpart;
                      return (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => handleOpenExistingRoom(room)}
                          className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 text-left cursor-pointer transition"
                        >
                          <AvatarCircle name={other?.full_name || '?'} role={other?.role} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-xs font-extrabold text-slate-900 truncate">
                                  {other?.full_name || 'Club Member'}
                                </span>
                                {other && other.role !== 'member' && (
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                                      other.role === 'owner'
                                        ? 'bg-amber-100 text-amber-900'
                                        : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {roleLabel(other.role)}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0">
                                {formatShortTime(room.last_message_at)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-0.5">
                              <p
                                className={`text-[11px] truncate ${
                                  room.hasUnread
                                    ? 'font-bold text-slate-900'
                                    : 'text-slate-500'
                                }`}
                              >
                                {room.last_message_text || other?.member_type || 'Start chatting'}
                              </p>
                              {room.hasUnread && (
                                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )
                ) : directoryMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No matching members found.
                  </div>
                ) : (
                  directoryMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => void handleOpenMemberChat(m)}
                      className="w-full p-3 flex items-center justify-between gap-3 hover:bg-emerald-50/50 text-left cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <AvatarCircle name={m.full_name} role={m.role} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900 truncate">
                              {m.full_name}
                            </span>
                            {m.role === 'owner' && (
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-extrabold uppercase shrink-0">
                                Owner
                              </span>
                            )}
                            {m.role === 'treasurer' && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9px] font-extrabold uppercase shrink-0">
                                <ShieldCheck className="w-2.5 h-2.5" /> Admin
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {m.matric_no ? `${m.matric_no} · ` : ''}
                            {m.member_type}
                            {m.batch_year ? ` · ${m.batch_year}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] shrink-0">
                        Chat
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Bottom-Right Floating Chat Button */}
      <button
        type="button"
        onClick={() => onToggleOpen(!isOpen)}
        className="relative w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-xl border border-emerald-400/50 flex items-center justify-center cursor-pointer transition hover:scale-105"
        aria-label="Toggle Club Chat"
        title="Club Chat"
      >
        {isOpen ? <X className="w-5 h-5" /> : <MessageCircle className="w-5 h-5" />}
        {!isOpen && unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
}
