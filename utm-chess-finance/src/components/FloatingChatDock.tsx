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
  Minus,
  Pin,
  PinOff,
  Trash2,
  Hash,
  User,
  Sparkles,
  RotateCcw,
  WifiOff,
} from 'lucide-react';

interface FloatingChatDockProps {
  profile: UserProfile;
  departments: string[];
  isOpen: boolean;
  onToggleOpen: (open: boolean) => void;
  unreadCount: number;
  onUnreadCountChange: (count: number) => void;
  isAdminMode?: boolean;
  onOpenMemberProfile?: (member: ChatDirectoryMember) => void;
  openDmWithUserId?: string | null;
  onClearOpenDmTarget?: () => void;
  onUpdatedPublicReadAt?: (iso: string) => void;
  aiContext?: Record<string, unknown>;
  aiRole?: 'member' | 'treasurer' | 'owner';
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

interface PublicRoomInfo {
  id: string;
  dm_key: string;
  title: string;
  pinned_message_text: string;
  pinned_by: string | null;
  pinned_at: string | null;
  last_message_at: string;
  last_message_sender_id: string | null;
}

const PAGE_SIZE = 30;
const MAX_MESSAGE_LENGTH = 1000;
const SEND_COOLDOWN_MS = 1500;
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

function AvatarCircle({ name, role, small = false }: { name: string; role?: string; small?: boolean }) {
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
      className={`${small ? 'w-7 h-7 text-[10px]' : 'w-9 h-9 text-xs'} rounded-full flex items-center justify-center font-extrabold shrink-0 ${bg}`}
    >
      {initials || '?'}
    </div>
  );
}

export default function FloatingChatDock({
  profile,
  departments,
  isOpen,
  onToggleOpen,
  unreadCount,
  onUnreadCountChange,
  isAdminMode = false,
  onOpenMemberProfile,
  openDmWithUserId = null,
  onClearOpenDmTarget,
  onUpdatedPublicReadAt,
  aiContext,
  aiRole,
}: FloatingChatDockProps) {
  const resolvedAiRole: 'member' | 'treasurer' | 'owner' =
    aiRole || (profile.role === 'owner' ? 'owner' : profile.role === 'treasurer' && isAdminMode ? 'treasurer' : 'member');
  const [viewTab, setViewTab] = useState<'public' | 'dms' | 'people' | 'ai'>('public');

  interface AiChatBubble {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    source?: 'gemini' | 'local';
  }
  const [aiMessages, setAiMessages] = useState<AiChatBubble[]>([]);
  const [aiDraft, setAiDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiOfflineNotice, setAiOfflineNotice] = useState<string | null>(null);
  const aiScrollRef = useRef<HTMLDivElement | null>(null);

  const aiStarterChips =
    resolvedAiRole === 'treasurer' || resolvedAiRole === 'owner'
      ? [
          'Summarize club budget health',
          'Which claims need my review?',
          'Spot high-spend categories',
        ]
      : [
          'How do I submit a claim?',
          'What events are coming up?',
          'Check my pending claims & loans',
        ];

  useEffect(() => {
    if (viewTab === 'ai' && aiScrollRef.current) {
      aiScrollRef.current.scrollTop = aiScrollRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading, viewTab]);

  const sendAiQuestion = async (rawPrompt: string) => {
    const clean = rawPrompt.trim();
    if (!clean || aiLoading) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAiOfflineNotice('You are offline. Reconnect to reach the AI assistant (showing local guide fallback when available).');
    } else {
      setAiOfflineNotice(null);
    }

    const userMsg: AiChatBubble = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: clean,
    };
    const nextHistory = [...aiMessages, userMsg].slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setAiMessages((prev) => [...prev, userMsg]);
    setAiDraft('');
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: clean,
          history: nextHistory,
          mode: 'portal',
          role: resolvedAiRole,
          context: aiContext || {},
        }),
      });
      if (!res.ok) throw new Error('Assistant unavailable');
      const data = (await res.json()) as {
        reply?: string;
        source?: 'gemini' | 'local';
      };
      setAiMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Sorry, I could not generate a reply right now.',
          source: data.source === 'gemini' ? 'gemini' : 'local',
        },
      ]);
    } catch {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content:
            'Unable to reach the assistant server right now. Check your internet connection or use the portal tabs (**Home & Activities**, **Claims**, **Equipment**) directly.',
          source: 'local',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };
  const [directory, setDirectory] = useState<ChatDirectoryMember[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [publicRoom, setPublicRoom] = useState<PublicRoomInfo | null>(null);
  const [publicHasUnread, setPublicHasUnread] = useState(false);
  const [loadingList, setLoadingList] = useState(false);

  // People directory filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'HIGH_COM'>('ALL');
  const [deptFilter, setDeptFilter] = useState<string>('ALL');

  // Active DM conversation (only used when viewTab === 'dms')
  const [activeDmRoomId, setActiveDmRoomId] = useState<string | null>(null);
  const [activeTarget, setActiveTarget] = useState<ChatDirectoryMember | null>(null);

  // Feed state shared by active room (Public Lounge or active DM)
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
  const lastSentAtRef = useRef<number>(0);

  // Keep volatile callback/timestamp props in refs so effects do not re-fire in loops
  const onUnreadCountChangeRef = useRef(onUnreadCountChange);
  onUnreadCountChangeRef.current = onUnreadCountChange;
  const onUpdatedPublicReadAtRef = useRef(onUpdatedPublicReadAt);
  onUpdatedPublicReadAtRef.current = onUpdatedPublicReadAt;
  const onClearOpenDmTargetRef = useRef(onClearOpenDmTarget);
  onClearOpenDmTargetRef.current = onClearOpenDmTarget;
  const publicReadAtRef = useRef(profile.public_chat_read_at);
  publicReadAtRef.current = profile.public_chat_read_at;

  const activeFeedRoomId =
    viewTab === 'public'
      ? publicRoom?.id || null
      : viewTab === 'dms'
      ? activeDmRoomId
      : null;

  const memberMap = React.useMemo(
    () => new Map<string, ChatDirectoryMember>(directory.map((u) => [u.id, u])),
    [directory]
  );

  const refreshUnreadCount = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_unread_chat_count');
    if (!error && typeof data === 'number') {
      onUnreadCountChangeRef.current(data);
    }
  }, []);

  const markPublicRead = useCallback(async () => {
    const iso = new Date().toISOString();
    publicReadAtRef.current = iso;
    setPublicHasUnread(false);
    onUpdatedPublicReadAtRef.current?.(iso);
    await supabase
      .from('users')
      .update({ public_chat_read_at: iso })
      .eq('id', profile.id);
  }, [profile.id]);

  const markDmRoomRead = useCallback(
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

  const loadDirectoryAndRooms = useCallback(async () => {
    setLoadingList(true);
    setChatError(null);
    try {
      const [dirRes, myPartRes, pubRpcRes] = await Promise.all([
        supabase
          .from('users_public')
          .select('*')
          .order('full_name', { ascending: true }),
        supabase
          .from('chat_participants')
          .select('room_id, last_read_at')
          .eq('user_id', profile.id),
        supabase.rpc('get_public_chat_room_id'),
      ]);

      const dirList = ((dirRes.data || []) as ChatDirectoryMember[]).map((u) => ({
        ...u,
        member_type: u.member_type || 'Member',
        batch_year: u.batch_year || '',
        allow_whatsapp_chat: Boolean(u.allow_whatsapp_chat),
      }));
      setDirectory(dirList);
      const localMap = new Map<string, ChatDirectoryMember>(dirList.map((u) => [u.id, u]));

      // Load Public Club Lounge metadata (via RPC id, with direct dm_key fallback)
      let pubRow: {
        id: string;
        dm_key: string;
        title?: string | null;
        pinned_message_text?: string | null;
        pinned_by?: string | null;
        pinned_at?: string | null;
        last_message_at?: string | null;
        last_message_sender_id?: string | null;
      } | null = null;

      if (!pubRpcRes.error && pubRpcRes.data) {
        const pubId = String(pubRpcRes.data);
        const { data } = await supabase
          .from('chat_rooms')
          .select(
            'id, dm_key, title, pinned_message_text, pinned_by, pinned_at, last_message_at, last_message_sender_id'
          )
          .eq('id', pubId)
          .maybeSingle();
        pubRow = data;
      } else {
        const { data } = await supabase
          .from('chat_rooms')
          .select(
            'id, dm_key, title, pinned_message_text, pinned_by, pinned_at, last_message_at, last_message_sender_id'
          )
          .eq('dm_key', 'PUBLIC::CLUB_LOUNGE')
          .maybeSingle();
        pubRow = data;
      }

      if (pubRow) {
        const parsedPub: PublicRoomInfo = {
          id: pubRow.id,
          dm_key: pubRow.dm_key,
          title: pubRow.title || 'Club Lounge',
          pinned_message_text: pubRow.pinned_message_text || '',
          pinned_by: pubRow.pinned_by || null,
          pinned_at: pubRow.pinned_at || null,
          last_message_at: pubRow.last_message_at || '',
          last_message_sender_id: pubRow.last_message_sender_id || null,
        };
        setPublicRoom(parsedPub);

        const myPublicRead = publicReadAtRef.current
          ? new Date(publicReadAtRef.current).getTime()
          : 0;
        const pubLastMsg = parsedPub.last_message_at
          ? new Date(parsedPub.last_message_at).getTime()
          : 0;
        setPublicHasUnread(
          Boolean(
            parsedPub.last_message_sender_id &&
              parsedPub.last_message_sender_id !== profile.id &&
              pubLastMsg > myPublicRead
          )
        );
      } else if (pubRpcRes.error) {
        setChatError(pubRpcRes.error.message || 'Public Club Lounge is not ready yet.');
      }

      const myParts = (myPartRes.data || []) as { room_id: string; last_read_at: string }[];
      if (myParts.length === 0) {
        setRooms([]);
        onUnreadCountChangeRef.current(0);
        return;
      }

      const roomIds = myParts.map((p) => p.room_id);
      const readMap = new Map(myParts.map((p) => [p.room_id, p.last_read_at]));

      const [roomsRes, allPartsRes] = await Promise.all([
        supabase
          .from('chat_rooms')
          .select('id, dm_key, last_message_text, last_message_sender_id, last_message_at, room_type')
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
          room_type?: string;
          last_message_text: string | null;
          last_message_sender_id: string | null;
          last_message_at: string | null;
        }[]
      )
        .filter((r) => r.room_type !== 'public' && r.dm_key !== 'PUBLIC::CLUB_LOUNGE')
        .map((r) => {
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
            counterpart: otherId ? localMap.get(otherId) : undefined,
            hasUnread,
          };
        });

      setRooms(builtRooms);
      onUnreadCountChangeRef.current(builtRooms.filter((r) => r.hasUnread).length);
    } catch (err) {
      setChatError(err instanceof Error ? err.message : 'Could not load chat.');
    } finally {
      setLoadingList(false);
    }
  }, [profile.id]);

  useEffect(() => {
    if (isOpen) {
      void loadDirectoryAndRooms();
    } else {
      setEmojiOpen(false);
    }
  }, [isOpen, loadDirectoryAndRooms]);

  const handleOpenMemberChat = useCallback(
    async (member: ChatDirectoryMember) => {
      if (member.id === profile.id) return;
      setChatError(null);
      const { data, error } = await supabase.rpc('get_or_create_dm_room', {
        target_user_id: member.id,
      });
      if (error || !data) {
        setChatError(error?.message || 'Could not start conversation.');
        return;
      }
      setViewTab('dms');
      setActiveTarget(member);
      setActiveDmRoomId(String(data));
      setEmojiOpen(false);
    },
    [profile.id]
  );

  // Respond to external DM launch (e.g. from MemberProfileModal -> Message in Club Chat)
  useEffect(() => {
    if (!isOpen || !openDmWithUserId) return;

    let cancelled = false;
    (async () => {
      let target = directory.find((m) => m.id === openDmWithUserId) || null;
      if (!target) {
        const { data } = await supabase
          .from('users_public')
          .select('*')
          .eq('id', openDmWithUserId)
          .maybeSingle();
        if (data) {
          target = data as ChatDirectoryMember;
        }
      }
      if (cancelled) return;
      if (target) {
        await handleOpenMemberChat(target);
      }
      onClearOpenDmTargetRef.current?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [isOpen, openDmWithUserId, directory, handleOpenMemberChat]);

  // Latest 30 messages + Realtime ONLY while dock is open & an active room is displayed
  useEffect(() => {
    if (!isOpen || !activeFeedRoomId) return;

    const isPublicFeed = viewTab === 'public';
    let cancelled = false;
    setLoadingMsgs(true);
    setChatError(null);
    setHasMoreMessages(false);

    (async () => {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id, content, is_deleted, deleted_by, created_at')
        .eq('room_id', activeFeedRoomId)
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

      if (isPublicFeed) {
        void markPublicRead();
      } else {
        void markDmRoomRead(activeFeedRoomId);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'auto' }), 40);
    })();

    const channel = supabase
      .channel(`clubsync-dock-${activeFeedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeFeedRoomId}`,
        },
        (payload) => {
          const incoming = payload.new as ChatMessageItem;
          if (!incoming?.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
          if (incoming.sender_id !== profile.id) {
            if (isPublicFeed) {
              void markPublicRead();
            } else {
              void markDmRoomRead(activeFeedRoomId);
            }
          }
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${activeFeedRoomId}`,
        },
        (payload) => {
          const updated = payload.new as ChatMessageItem;
          if (!updated?.id) return;
          setMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
          );
        }
      );

    if (isPublicFeed) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_rooms',
          filter: `id=eq.${activeFeedRoomId}`,
        },
        (payload) => {
          const updatedRoom = payload.new as Partial<PublicRoomInfo>;
          setPublicRoom((prev) =>
            prev
              ? {
                  ...prev,
                  pinned_message_text: updatedRoom.pinned_message_text ?? prev.pinned_message_text,
                  pinned_by: updatedRoom.pinned_by ?? prev.pinned_by,
                  pinned_at: updatedRoom.pinned_at ?? prev.pinned_at,
                }
              : prev
          );
        }
      );
    }

    channel.subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [isOpen, activeFeedRoomId, viewTab, profile.id, markDmRoomRead, markPublicRead]);

  const handleLoadEarlier = async () => {
    if (!activeFeedRoomId || messages.length === 0 || loadingEarlier) return;
    setLoadingEarlier(true);
    try {
      const oldest = messages[0].created_at;
      const { data } = await supabase
        .from('chat_messages')
        .select('id, room_id, sender_id, content, is_deleted, deleted_by, created_at')
        .eq('room_id', activeFeedRoomId)
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
    setActiveDmRoomId(room.id);
    setEmojiOpen(false);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedRoomId || sendingMsg) return;
    const trimmed = msgDraft.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

    const now = Date.now();
    if (now - lastSentAtRef.current < SEND_COOLDOWN_MS) {
      setChatError('Please wait a second before sending another message.');
      return;
    }

    setSendingMsg(true);
    setChatError(null);
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: activeFeedRoomId,
          sender_id: profile.id,
          content: trimmed,
        })
        .select('id, room_id, sender_id, content, is_deleted, deleted_by, created_at')
        .single();

      if (error) {
        setChatError(error.message || 'Could not send message.');
        return;
      }

      lastSentAtRef.current = Date.now();
      if (data) {
        const inserted = data as ChatMessageItem;
        setMessages((prev) =>
          prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
        );
      }
      setMsgDraft('');
      setEmojiOpen(false);
      if (viewTab === 'public') {
        void markPublicRead();
      } else {
        void markDmRoomRead(activeFeedRoomId);
      }
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleHideMessage = async (messageId: string) => {
    setChatError(null);
    const { data, error } = await supabase.rpc('hide_chat_message', {
      p_message_id: messageId,
    });
    if (error || !data) {
      setChatError(error?.message || 'Could not remove message.');
      return;
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, is_deleted: true, deleted_by: profile.id } : m
      )
    );
  };

  const handlePinMessage = async (text: string) => {
    if (!publicRoom || !isAdminMode) return;
    setChatError(null);
    const cleanText = text.trim().slice(0, 180);
    const { error } = await supabase
      .from('chat_rooms')
      .update({
        pinned_message_text: cleanText,
        pinned_by: cleanText ? profile.id : null,
        pinned_at: cleanText ? new Date().toISOString() : null,
      })
      .eq('id', publicRoom.id);

    if (error) {
      setChatError(error.message || 'Could not update pinned message.');
      return;
    }
    setPublicRoom((prev) =>
      prev
        ? {
            ...prev,
            pinned_message_text: cleanText,
            pinned_by: cleanText ? profile.id : null,
            pinned_at: cleanText ? new Date().toISOString() : null,
          }
        : prev
    );
  };

  const handleContinueOnWhatsApp = async () => {
    if (!activeTarget?.id || !activeTarget.allow_whatsapp_chat || openingWa) return;
    setOpeningWa(true);
    try {
      const { data } = await supabase.rpc('get_whatsapp_chat_phone', {
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
      const hay = `${m.full_name} ${m.matric_no} ${m.member_type} ${m.course || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => onToggleOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-5 md:right-5 z-40 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xl border border-emerald-400/50 cursor-pointer transition hover:scale-105"
        aria-label="Open Club Chat"
        title="Club Chat"
      >
        <MessageCircle className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">Club Chat</span>
        {unreadCount > 0 && (
          <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
    );
  }

  const inDmConversation = viewTab === 'dms' && Boolean(activeDmRoomId && activeTarget);

  const renderMessageFeed = (isPublicFeed: boolean) => (
    <>
      {/* Pinned Notice Banner in Public Lounge */}
      {isPublicFeed && publicRoom?.pinned_message_text && (
        <div className="px-3.5 py-2 bg-amber-50 border-b border-amber-200 flex items-start justify-between gap-2 text-xs text-amber-950 shrink-0">
          <div className="flex items-start gap-2 min-w-0">
            <Pin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 block">
                Pinned Notice
              </span>
              <p className="text-[11px] font-medium text-amber-950 break-words">
                {publicRoom.pinned_message_text}
              </p>
            </div>
          </div>
          {isAdminMode && (
            <button
              type="button"
              onClick={() => void handlePinMessage('')}
              className="p-1 rounded hover:bg-amber-200/70 text-amber-800 shrink-0 cursor-pointer"
              title="Unpin notice"
            >
              <PinOff className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

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

        {loadingMsgs || (isPublicFeed && loadingList && !publicRoom) ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-xs text-slate-400 px-6 space-y-1">
            <MessageCircle className="w-7 h-7 text-slate-300" />
            <p className="font-semibold text-slate-500">
              {isPublicFeed
                ? 'Welcome to the Club Lounge!'
                : `Say hi to ${activeTarget?.full_name || 'Member'}!`}
            </p>
            <p className="text-[11px]">
              {isPublicFeed
                ? 'Everyone in the club can chat here.'
                : 'Text & emoji messages only.'}
            </p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id === profile.id;
            const sender = memberMap.get(m.sender_id);
            const canHide = !m.is_deleted && (isMine || (isPublicFeed && isAdminMode));
            const canPin = !m.is_deleted && isPublicFeed && isAdminMode;

            if (m.is_deleted) {
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div className="px-3 py-1.5 rounded-xl text-[11px] italic text-slate-400 bg-slate-100 border border-slate-200/70">
                    Message removed
                  </div>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`group flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
              >
                {isPublicFeed && !isMine && (
                  <div className="flex items-center gap-1.5 mb-0.5 px-0.5">
                    <AvatarCircle
                      name={sender?.full_name || 'Member'}
                      role={sender?.role}
                      small
                    />
                    {sender && onOpenMemberProfile ? (
                      <button
                        type="button"
                        onClick={() => onOpenMemberProfile(sender)}
                        className="text-[11px] font-bold text-slate-700 hover:text-emerald-700 hover:underline cursor-pointer"
                      >
                        {sender.full_name}
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-700">
                        {sender?.full_name || 'Club Member'}
                      </span>
                    )}
                    {sender && sender.role !== 'member' && (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${
                          sender.role === 'owner'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {roleLabel(sender.role)}
                      </span>
                    )}
                  </div>
                )}

                <div className={`flex items-end gap-1.5 max-w-[90%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div
                    className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap shadow-2xs ${
                      isMine
                        ? 'bg-emerald-600 text-white rounded-br-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
                    }`}
                  >
                    {m.content}
                  </div>
                  {(canPin || canHide) && (
                    <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex items-center gap-0.5 transition-opacity shrink-0">
                      {canPin && (
                        <button
                          type="button"
                          onClick={() => void handlePinMessage(m.content)}
                          className="p-1 rounded-md hover:bg-amber-100 text-slate-400 hover:text-amber-700 cursor-pointer"
                          title="Pin in Club Lounge"
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}
                      {canHide && (
                        <button
                          type="button"
                          onClick={() => void handleHideMessage(m.id)}
                          className="p-1 rounded-md hover:bg-rose-100 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remove message"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
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

      {/* Compact Emoji Picker Popover */}
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
            placeholder={
              isPublicFeed ? 'Message everyone in Club Lounge...' : 'Type a message...'
            }
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3 py-2 text-xs focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={sendingMsg || !msgDraft.trim() || !activeFeedRoomId}
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
  );

  return (
    <div className="fixed bottom-20 right-3 md:bottom-5 md:right-5 z-40 w-[370px] max-w-[calc(100vw-1.5rem)] h-[520px] sm:h-[540px] max-h-[75vh] sm:max-h-[82vh] rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden bg-white text-slate-900">
      {inDmConversation && activeTarget ? (
        <>
          {/* DM Conversation Header (NO raw phone numbers or PII) */}
          <div className="px-3.5 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => {
                  setActiveDmRoomId(null);
                  setActiveTarget(null);
                  setMessages([]);
                  void loadDirectoryAndRooms();
                }}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-200 cursor-pointer shrink-0"
                aria-label="Back to DMs"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <AvatarCircle name={activeTarget.full_name} role={activeTarget.role} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {onOpenMemberProfile ? (
                    <button
                      type="button"
                      onClick={() => onOpenMemberProfile(activeTarget)}
                      className="text-xs font-extrabold truncate hover:text-emerald-300 hover:underline cursor-pointer text-left"
                      title="Inspect profile"
                    >
                      {activeTarget.full_name}
                    </button>
                  ) : (
                    <span className="text-xs font-extrabold truncate">
                      {activeTarget.full_name}
                    </span>
                  )}
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
              {onOpenMemberProfile && (
                <button
                  type="button"
                  onClick={() => onOpenMemberProfile(activeTarget)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold cursor-pointer"
                  title="Inspect member profile"
                >
                  <User className="w-3 h-3" />
                  <span>Profile</span>
                </button>
              )}
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
                aria-label="Minimize chat"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {renderMessageFeed(false)}
        </>
      ) : (
        <>
          {/* Dock Header */}
          <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-extrabold">Club Chat</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/10 text-emerald-200">
                {viewTab === 'public'
                  ? 'Club Lounge'
                  : viewTab === 'dms'
                  ? 'Direct Messages'
                  : viewTab === 'people'
                  ? 'Member Directory'
                  : 'Ask AI'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onToggleOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              aria-label="Minimize chat"
              title="Minimize"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 4 Tabs: Public | DMs | People | Ask AI */}
          <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 text-[11px] font-bold shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewTab('public');
                setEmojiOpen(false);
                void markPublicRead();
              }}
              className={`py-2.5 border-b-2 cursor-pointer transition inline-flex items-center justify-center gap-1 ${
                viewTab === 'public'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Hash className="w-3.5 h-3.5 shrink-0" />
              <span>Public</span>
              {publicHasUnread && viewTab !== 'public' && (
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTab('dms');
                setEmojiOpen(false);
              }}
              className={`py-2.5 border-b-2 cursor-pointer transition inline-flex items-center justify-center gap-1 ${
                viewTab === 'dms'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>DMs ({rooms.length})</span>
              {unreadCount > 0 && (
                <span className="min-w-[16px] h-4 px-1 rounded-full bg-rose-600 text-white text-[9px] font-extrabold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTab('people');
                setEmojiOpen(false);
              }}
              className={`py-2.5 border-b-2 cursor-pointer transition inline-flex items-center justify-center gap-1 ${
                viewTab === 'people'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>People ({Math.max(0, directory.length - 1)})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setViewTab('ai');
                setEmojiOpen(false);
              }}
              className={`py-2.5 border-b-2 cursor-pointer transition inline-flex items-center justify-center gap-1 ${
                viewTab === 'ai'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Ask AI</span>
            </button>
          </div>

          {viewTab === 'public' ? (
            renderMessageFeed(true)
          ) : viewTab === 'ai' ? (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-50">
              <div className="px-3 py-2 border-b border-slate-200 bg-white flex items-center justify-between gap-2 text-[11px] shrink-0">
                <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>
                    {resolvedAiRole === 'member'
                      ? 'Member Portal Guide'
                      : 'Treasurer & Portal Assistant'}
                  </span>
                </div>
                {aiMessages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAiMessages([]);
                      setAiOfflineNotice(null);
                    }}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Clear Chat</span>
                  </button>
                )}
              </div>

              {aiOfflineNotice && (
                <div className="mx-3 mt-2 px-2.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 font-semibold flex items-center gap-1.5 shrink-0">
                  <WifiOff className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{aiOfflineNotice}</span>
                </div>
              )}

              <div ref={aiScrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
                {aiMessages.length === 0 ? (
                  <div className="space-y-3 py-2">
                    <div className="p-3 rounded-2xl bg-white border border-emerald-100 shadow-2xs space-y-1.5">
                      <p className="font-extrabold text-slate-900 text-xs flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Hi {profile.full_name.split(' ')[0]}! How can I help?</span>
                      </p>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {resolvedAiRole === 'member'
                          ? 'Ask about upcoming club activities, how to submit claims or pre-claims, your own claim status, or equipment loans.'
                          : 'Ask about club budget health, pending claims awaiting review, upcoming activities, or category spending.'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                        Quick Prompts
                      </p>
                      <div className="flex flex-col gap-1.5">
                        {aiStarterChips.map((chip) => (
                          <button
                            key={chip}
                            type="button"
                            onClick={() => void sendAiQuestion(chip)}
                            className="text-left px-3 py-2 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 text-slate-800 font-semibold text-[11px] transition cursor-pointer"
                          >
                            {chip}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  aiMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3 py-2 leading-relaxed whitespace-pre-line ${
                          msg.role === 'user'
                            ? 'bg-emerald-600 text-white rounded-br-sm font-medium'
                            : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-2xs'
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === 'assistant' && msg.source && (
                        <span className="mt-1 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          {msg.source === 'gemini' ? 'AI' : 'Quick Guide'}
                        </span>
                      )}
                    </div>
                  ))
                )}

                {aiLoading && (
                  <div className="flex items-start">
                    <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5 text-slate-600 text-[11px] font-semibold">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                      <span>Thinking...</span>
                    </div>
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void sendAiQuestion(aiDraft);
                }}
                className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  value={aiDraft}
                  onChange={(e) => setAiDraft(e.target.value)}
                  placeholder="Ask ClubSync Assistant..."
                  className="flex-1 min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={aiLoading || !aiDraft.trim()}
                  className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white cursor-pointer shrink-0"
                  aria-label="Send question to AI"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <>
              {viewTab === 'people' && (
                <div className="p-3 border-b border-slate-200 space-y-2 bg-white shrink-0 text-xs">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search name, matric, department, course..."
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

              {/* Body List for DMs / People */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 bg-white">
                {loadingList ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                  </div>
                ) : viewTab === 'dms' ? (
                  rooms.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-xs text-slate-500">
                      <MessageCircle className="w-8 h-8 text-slate-300" />
                      <p className="font-bold text-slate-700">No direct messages yet</p>
                      <p className="text-[11px] text-slate-400">
                        Chat privately with any club member or High-Com officer.
                      </p>
                      <button
                        type="button"
                        onClick={() => setViewTab('people')}
                        className="mt-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Find someone to message →
                      </button>
                    </div>
                  ) : (
                    rooms.map((room) => {
                      const other = room.counterpart;
                      return (
                        <div
                          key={room.id}
                          onClick={() => handleOpenExistingRoom(room)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleOpenExistingRoom(room);
                            }
                          }}
                          className="w-full p-3 flex items-center gap-3 hover:bg-slate-50 text-left cursor-pointer transition"
                        >
                          <AvatarCircle name={other?.full_name || '?'} role={other?.role} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {other && onOpenMemberProfile ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenMemberProfile(other);
                                    }}
                                    className="text-xs font-extrabold text-slate-900 truncate hover:text-emerald-700 hover:underline cursor-pointer"
                                    title="Inspect profile"
                                  >
                                    {other.full_name}
                                  </button>
                                ) : (
                                  <span className="text-xs font-extrabold text-slate-900 truncate">
                                    {other?.full_name || 'Club Member'}
                                  </span>
                                )}
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
                        </div>
                      );
                    })
                  )
                ) : directoryMembers.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400">
                    No matching members found.
                  </div>
                ) : (
                  directoryMembers.map((m) => (
                    <div
                      key={m.id}
                      className="w-full p-3 flex items-center justify-between gap-3 hover:bg-emerald-50/40 transition"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenMemberProfile) {
                            onOpenMemberProfile(m);
                          } else {
                            void handleOpenMemberChat(m);
                          }
                        }}
                        className="flex items-center gap-2.5 min-w-0 text-left flex-1 cursor-pointer group"
                        title="View member profile"
                      >
                        <AvatarCircle name={m.full_name} role={m.role} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-extrabold text-slate-900 truncate group-hover:text-emerald-700 group-hover:underline">
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
                      </button>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onOpenMemberProfile && (
                          <button
                            type="button"
                            onClick={() => onOpenMemberProfile(m)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer transition"
                            title="View member profile"
                          >
                            <User className="w-3 h-3" />
                            <span>Profile</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void handleOpenMemberChat(m)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-600 hover:text-white text-emerald-700 font-bold text-[11px] cursor-pointer transition"
                        >
                          Message
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
