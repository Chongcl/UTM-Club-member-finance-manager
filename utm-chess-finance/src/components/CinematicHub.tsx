'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  Announcement,
  Poll,
  PollVote,
  UserProfile,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/supabase';
import {
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Pin,
  BarChart2,
  PlusCircle,
  Trash2,
  X,
  CheckCircle2,
  Megaphone,
  Maximize2,
  Loader2,
  Edit3,
} from 'lucide-react';

interface CinematicHubProps {
  announcements: Announcement[];
  polls: Poll[];
  pollVotes: PollVote[];
  profile: UserProfile;
  isAdmin: boolean;
  onRefresh: (msg: string) => void;
}

export default function CinematicHub({
  announcements,
  polls,
  pollVotes,
  profile,
  isAdmin,
  onRefresh,
}: CinematicHubProps) {
  const carouselSlides = announcements.filter((a) => a.show_in_carousel);
  const pinnedNotices = announcements.filter((a) => a.is_pinned);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedPoster, setSelectedPoster] = useState<Announcement | null>(null);

  // Admin Modals for Poster/Announcement & Poll
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [externalLink, setExternalLink] = useState('');
  const [linkLabel, setLinkLabel] = useState('Visit Instagram / More Details');
  const [isPinned, setIsPinned] = useState(true);
  const [showInCarousel, setShowInCarousel] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState(
    'Design A: Emerald Polo\nDesign B: Black Oversized Tee\nDesign C: White Classic Jersey'
  );
  const [savingPoll, setSavingPoll] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null);

  // Auto-scroll timer (every 5 seconds)
  useEffect(() => {
    if (carouselSlides.length <= 1 || isPaused || selectedPoster) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [carouselSlides.length, isPaused, selectedPoster]);

  const openCreateNotice = () => {
    setEditingNotice(null);
    setTitle('');
    setSubtitle('Featured Club Event • Click for Details');
    setContent('');
    setPosterUrl('');
    setPosterFile(null);
    setExternalLink('');
    setLinkLabel('View on Instagram / More Info');
    setIsPinned(true);
    setShowInCarousel(true);
    setShowNoticeModal(true);
  };

  const openEditNotice = (a: Announcement) => {
    setEditingNotice(a);
    setTitle(a.title);
    setSubtitle(a.subtitle || '');
    setContent(a.content);
    setPosterUrl(a.poster_url || '');
    setPosterFile(null);
    setExternalLink(a.external_link || '');
    setLinkLabel(a.link_label || 'View on Instagram / More Info');
    setIsPinned(a.is_pinned);
    setShowInCarousel(a.show_in_carousel);
    setShowNoticeModal(true);
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotice(true);
    try {
      let finalPosterUrl = posterUrl.trim();
      if (posterFile && posterFile.size <= MAX_FILE_SIZE_BYTES) {
        const ext = posterFile.name.split('.').pop() || 'jpg';
        const path = `posters/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, posterFile);
        if (!upErr) {
          finalPosterUrl = supabase.storage.from('receipts').getPublicUrl(path)
            .data.publicUrl;
        }
      }

      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim(),
        content: content.trim(),
        poster_url:
          finalPosterUrl ||
          'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80',
        external_link: externalLink.trim(),
        link_label: linkLabel.trim() || 'More Details',
        is_pinned: isPinned,
        show_in_carousel: showInCarousel,
        created_by: profile.full_name,
      };

      if (editingNotice) {
        await supabase.from('announcements').update(payload).eq('id', editingNotice.id);
        onRefresh('Poster / Announcement updated!');
      } else {
        await supabase.from('announcements').insert(payload);
        onRefresh('Published to Cinematic Showcase & Notice Board!');
      }
      setShowNoticeModal(false);
    } finally {
      setSavingNotice(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    await supabase.from('announcements').delete().eq('id', id);
    setSelectedPoster(null);
    onRefresh('Announcement removed.');
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = pollOptionsText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!pollQuestion.trim() || opts.length < 2) return;

    setSavingPoll(true);
    try {
      await supabase.from('polls').insert({
        question: pollQuestion.trim(),
        options: opts,
        is_active: true,
        created_by: profile.full_name,
      });
      setPollQuestion('');
      setShowPollModal(false);
      onRefresh('Live Poll published!');
    } finally {
      setSavingPoll(false);
    }
  };

  const handleCastVote = async (pollId: string, optionIndex: number) => {
    setVotingPollId(pollId);
    try {
      await supabase.from('poll_votes').upsert(
        {
          poll_id: pollId,
          user_id: profile.id,
          voter_name: profile.full_name,
          option_index: optionIndex,
        },
        { onConflict: 'poll_id,user_id' }
      );
      onRefresh('Vote recorded!');
    } finally {
      setVotingPollId(null);
    }
  };

  const handleDeletePoll = async (pollId: string) => {
    await supabase.from('polls').delete().eq('id', pollId);
    onRefresh('Poll deleted.');
  };

  const activeSlide =
    carouselSlides.length > 0
      ? carouselSlides[currentSlide % carouselSlides.length]
      : null;

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. CINEMATIC AUTO-SCROLLING EVENT POSTER SHOWCASE
         ===================================================================== */}
      {activeSlide && (
        <div
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          className="relative rounded-3xl overflow-hidden shadow-xl border border-emerald-900/20 bg-slate-950 group"
        >
          {/* Widescreen Poster Background */}
          <div
            onClick={() => setSelectedPoster(activeSlide)}
            className="relative h-[300px] sm:h-[380px] w-full cursor-pointer overflow-hidden"
          >
            <img
              src={
                activeSlide.poster_url ||
                'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80'
              }
              alt={activeSlide.title}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700 opacity-75"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-transparent" />

            {/* Top Badges */}
            <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-emerald-500/90 text-white backdrop-blur-md shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-200" />
                <span>{activeSlide.subtitle || 'Featured Spotlight'}</span>
              </span>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isAdmin && (
                  <>
                    <button
                      type="button"
                      onClick={openCreateNotice}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 shadow-sm cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>+ Add Poster / Notice</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openEditNotice(activeSlide)}
                      className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md cursor-pointer"
                      title="Edit Slide"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPoster(activeSlide)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 hover:bg-white/25 text-white backdrop-blur-md border border-white/20 cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View Full Poster</span>
                </button>
              </div>
            </div>

            {/* Bottom Content Overlay */}
            <div className="absolute bottom-5 left-5 right-5 sm:left-8 sm:right-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-sm">
                  {activeSlide.title}
                </h2>
                <p className="text-xs sm:text-sm text-emerald-100/90 line-clamp-2">
                  {activeSlide.content}
                </p>
                <p className="text-[11px] text-amber-300 font-bold pt-1">
                  Click poster to view full details &amp; official links →
                </p>
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                {activeSlide.external_link && (
                  <a
                    href={activeSlide.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition"
                  >
                    <span>{activeSlide.link_label || 'More Details'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Left/Right Navigation Arrows & Slide Dots */}
          {carouselSlides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() =>
                  setCurrentSlide(
                    (prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length
                  )
                }
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setCurrentSlide((prev) => (prev + 1) % carouselSlides.length)
                }
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 transition cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                {carouselSlides.map((s, idx) => (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => setCurrentSlide(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentSlide % carouselSlides.length
                        ? 'w-7 bg-amber-400'
                        : 'w-2 bg-white/40 hover:bg-white/70'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* =====================================================================
          2. PINNED NOTICE BOARD & WHATSAPP-STYLE LIVE POLLS GRID
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 7 Cols: Pinned Notice Board */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-emerald-100 p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <Megaphone className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Pinned Notice Board &amp; Announcements
                </h3>
                <p className="text-[11px] text-slate-500">
                  Click any notice to open full poster view and external links
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={openCreateNotice}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Pin Notice</span>
              </button>
            )}
          </div>

          {pinnedNotices.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No pinned announcements right now.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {pinnedNotices.map((n) => (
                <div
                  key={n.id}
                  onClick={() => setSelectedPoster(n)}
                  className="p-3.5 rounded-2xl bg-emerald-50/50 hover:bg-emerald-50 border border-emerald-200/70 transition cursor-pointer flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    {n.poster_url && (
                      <img
                        src={n.poster_url}
                        alt={n.title}
                        className="w-12 h-12 rounded-xl object-cover border border-emerald-200 shrink-0"
                      />
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Pin className="w-3 h-3 text-emerald-700 shrink-0" />
                        <h4 className="text-xs font-extrabold text-slate-900">
                          {n.title}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-600 line-clamp-2">
                        {n.content}
                      </p>
                      {n.external_link && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 pt-0.5">
                          <span>{n.link_label || 'Open Link'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  </div>

                  {isAdmin && (
                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => openEditNotice(n)}
                        className="p-1.5 rounded-lg text-slate-500 hover:bg-white cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteNotice(n.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right 5 Cols: WhatsApp-Style Live Polls */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-emerald-100 p-5 shadow-2xs flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  Live Club Polls
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tap any option to vote or change your vote in real time
                </p>
              </div>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowPollModal(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ New Poll</span>
              </button>
            )}
          </div>

          {polls.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              No active polls right now.
            </p>
          ) : (
            <div className="space-y-4 max-h-[260px] overflow-y-auto pr-1">
              {polls.map((poll) => {
                const thisPollVotes = pollVotes.filter((v) => v.poll_id === poll.id);
                const totalVotes = thisPollVotes.length;
                const myVote = thisPollVotes.find((v) => v.user_id === profile.id);

                return (
                  <div
                    key={poll.id}
                    className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-xs font-extrabold text-slate-900">
                        {poll.question}
                      </h4>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeletePoll(poll.id)}
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {(poll.options || []).map((optText, idx) => {
                        const optVotes = thisPollVotes.filter(
                          (v) => v.option_index === idx
                        );
                        const pct =
                          totalVotes > 0
                            ? Math.round((optVotes.length / totalVotes) * 100)
                            : 0;
                        const isMyChoice = myVote?.option_index === idx;

                        return (
                          <button
                            type="button"
                            key={idx}
                            disabled={votingPollId === poll.id}
                            onClick={() => handleCastVote(poll.id, idx)}
                            className={`w-full text-left relative overflow-hidden rounded-xl border p-2.5 transition cursor-pointer ${
                              isMyChoice
                                ? 'border-emerald-600 bg-emerald-50/70'
                                : 'border-slate-200 bg-white hover:border-emerald-300'
                            }`}
                          >
                            <div
                              className={`absolute inset-y-0 left-0 transition-all ${
                                isMyChoice
                                  ? 'bg-emerald-500/20'
                                  : 'bg-slate-200/60'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative flex items-center justify-between gap-2 text-xs">
                              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                                {isMyChoice && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                                )}
                                <span>{optText}</span>
                              </span>
                              <span className="font-mono text-[11px] font-bold text-slate-600 shrink-0">
                                {pct}% ({optVotes.length})
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                      <span>Total Votes: {totalVotes}</span>
                      <span>
                        {myVote ? '✓ You voted (tap to switch)' : 'Tap an option to vote'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          3. FULL-SCREEN POSTER DETAIL & EXTERNAL REDIRECT LIGHTBOX MODAL
         ===================================================================== */}
      {selectedPoster && (
        <div
          onClick={() => setSelectedPoster(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-4xl w-full overflow-hidden my-8 grid grid-cols-1 md:grid-cols-2"
          >
            <div className="bg-slate-950 flex items-center justify-center min-h-[280px] max-h-[520px] overflow-hidden">
              <img
                src={
                  selectedPoster.poster_url ||
                  'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80'
                }
                alt={selectedPoster.title}
                className="w-full h-full object-contain"
              />
            </div>

            <div className="p-6 sm:p-8 flex flex-col justify-between space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">
                    {selectedPoster.subtitle || 'Club Spotlight'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedPoster(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <h2 className="text-xl font-extrabold text-slate-900">
                  {selectedPoster.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                  {selectedPoster.content}
                </p>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                {selectedPoster.external_link && (
                  <a
                    href={selectedPoster.external_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-2xl text-xs sm:text-sm font-extrabold bg-emerald-700 hover:bg-emerald-800 text-white shadow-md transition"
                  >
                    <span>
                      {selectedPoster.link_label ||
                        'Open Official Link (Instagram / Facebook)'}
                    </span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedPoster(null)}
                  className="w-full py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          4. ADMIN MODAL: CREATE / EDIT POSTER & PINNED NOTICE
         ===================================================================== */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-lg w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingNotice
                  ? 'Edit Poster / Announcement'
                  : 'Publish Event Poster / Pinned Notice'}
              </h3>
              <button
                type="button"
                onClick={() => setShowNoticeModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Event / Announcement Headline *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Annual Grand Tournament 2026"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Top Badge / Subtitle
                </label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g., Featured Event • Registration Open"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Full Details (Shown when user clicks poster) *
                </label>
                <textarea
                  rows={3}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write all event details, rules, or announcement info..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Upload Poster Image (Max 50MB)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPosterFile(e.target.files?.[0] || null)}
                    className="w-full text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-emerald-50 file:text-emerald-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Or Paste Poster Image URL
                  </label>
                  <input
                    type="url"
                    value={posterUrl}
                    onChange={(e) => setPosterUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200">
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    External Redirect Link (IG / FB / Form)
                  </label>
                  <input
                    type="url"
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                    placeholder="https://instagram.com/p/..."
                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Redirect Button Text
                  </label>
                  <input
                    type="text"
                    value={linkLabel}
                    onChange={(e) => setLinkLabel(e.target.value)}
                    placeholder="View on Instagram"
                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="flex items-center gap-5 pt-1">
                <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInCarousel}
                    onChange={(e) => setShowInCarousel(e.target.checked)}
                  />
                  <span>Show in Cinematic Auto-Scroll Banner</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPinned}
                    onChange={(e) => setIsPinned(e.target.checked)}
                  />
                  <span>Pin to Notice Board</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNoticeModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingNotice}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-700 text-white cursor-pointer"
                >
                  {savingNotice && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save &amp; Publish</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. ADMIN MODAL: CREATE WHATSAPP-STYLE LIVE POLL
         ===================================================================== */}
      {showPollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full overflow-hidden">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Create Live Club Poll</h3>
              <button
                type="button"
                onClick={() => setShowPollModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePoll} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Poll Question *
                </label>
                <input
                  type="text"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="e.g., Which T-shirt design or event time do you prefer?"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Voting Options (1 option per line) *
                </label>
                <textarea
                  rows={4}
                  value={pollOptionsText}
                  onChange={(e) => setPollOptionsText(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 font-medium"
                  required
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPollModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPoll}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-700 text-white cursor-pointer"
                >
                  {savingPoll && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Publish Poll</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}