import React, { useState, useEffect } from 'react';
import { supabase, Announcement, Poll, PollVote, UserProfile, ActivityLogEntry, MAX_FILE_SIZE_BYTES } from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import ModalShell from './ui/ModalShell';
import { Bookmark, ChevronLeft, ChevronRight, ExternalLink, Pin, BarChart2, PlusCircle, Trash2, X, CheckCircle2, Megaphone, Maximize2, Edit3, Eye, EyeOff, History } from 'lucide-react';

interface CinematicHubProps {
  announcements: Announcement[]; polls: Poll[]; pollVotes: PollVote[]; logs?: ActivityLogEntry[]; profile: UserProfile; isAdmin: boolean; onRefresh: (msg: string) => void;
}

export default function CinematicHub({ announcements, polls, pollVotes, logs = [], profile, isAdmin, onRefresh }: CinematicHubProps) {
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);
  const carouselSlides = announcements.filter((a) => a.show_in_carousel);
  const pinnedNotices = announcements.filter((a) => a.is_pinned);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [selectedPoster, setSelectedPoster] = useState<Announcement | null>(null);

  const [showNoticeModal, setShowNoticeModal] = useState(false);
  const [editingNotice, setEditingNotice] = useState<Announcement | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [externalLink, setExternalLink] = useState('');
  const [linkLabel, setLinkLabel] = useState('More Info');
  const [isPinned, setIsPinned] = useState(true);
  const [showInCarousel, setShowInCarousel] = useState(true);
  const [savingNotice, setSavingNotice] = useState(false);

  const [showPollModal, setShowPollModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionsText, setPollOptionsText] = useState('Option A\nOption B\nOption C');
  const [newPollShowNumbers, setNewPollShowNumbers] = useState(true);

  useEffect(() => {
    if (carouselSlides.length <= 1 || selectedPoster || showNoticeModal) return;
    const timer = setInterval(() => setCurrentSlide((prev) => (prev + 1) % carouselSlides.length), 5000);
    return () => clearInterval(timer);
  }, [carouselSlides.length, selectedPoster, showNoticeModal]);

  const openCreatePosterModal = () => {
    setEditingNotice(null);
    setTitle('');
    setSubtitle('');
    setContent('');
    setPosterUrl('');
    setPosterFile(null);
    setExternalLink('');
    setLinkLabel('More Info');
    setIsPinned(true);
    setShowInCarousel(true);
    setShowNoticeModal(true);
  };

  const openEditPosterModal = (notice: Announcement) => {
    setSelectedPoster(null);
    setEditingNotice(notice);
    setTitle(notice.title || '');
    setSubtitle(notice.subtitle || '');
    setContent(notice.content || '');
    setPosterUrl(notice.poster_url || '');
    setPosterFile(null);
    setExternalLink(notice.external_link || '');
    setLinkLabel(notice.link_label || 'More Info');
    setIsPinned(Boolean(notice.is_pinned));
    setShowInCarousel(Boolean(notice.show_in_carousel));
    setShowNoticeModal(true);
  };

  const isPollNumbersHidden = (poll: Poll) =>
    poll.show_results === false || poll.question.startsWith('[HIDE_NUM]');

  const cleanPollQuestion = (q: string) => q.replace(/^\[HIDE_NUM\]\s*/, '');

  const togglePollNumbersVisibility = async (poll: Poll) => {
    const nextShow = isPollNumbersHidden(poll);
    const cleanQ = cleanPollQuestion(poll.question);
    await supabase
      .from('polls')
      .update({ question: cleanQ, show_results: nextShow })
      .eq('id', poll.id);
    onRefresh(nextShow ? 'Live poll numbers visible to everyone.' : 'Live poll numbers hidden from members.');
  };

  const handleSaveNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingNotice(true);
    try {
      let finalPosterUrl = posterUrl.trim();
      if (posterFile && posterFile.size <= MAX_FILE_SIZE_BYTES) {
        const path = `posters/${Date.now()}.${posterFile.name.split('.').pop() || 'jpg'}`;
        const { error } = await supabase.storage.from('receipts').upload(path, posterFile);
        if (!error) finalPosterUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        title: title.trim(), subtitle: subtitle.trim(), content: content.trim(),
        poster_url: finalPosterUrl || 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1400&q=80',
        external_link: externalLink.trim(), link_label: linkLabel.trim() || 'More Details',
        is_pinned: isPinned, show_in_carousel: showInCarousel, created_by: profile.full_name,
      };
      if (editingNotice) {
        const { error } = await supabase.from('announcements').update(payload).eq('id', editingNotice.id);
        if (error) {
          await supabase.from('announcements').update({
            title: payload.title,
            content: payload.content,
            poster_url: payload.poster_url,
            is_pinned: payload.is_pinned,
            show_in_carousel: payload.show_in_carousel,
          }).eq('id', editingNotice.id);
        }
        const changes = computeFieldChanges([
          { field: 'Title', before: editingNotice.title, after: payload.title },
          { field: 'Badge', before: editingNotice.subtitle, after: payload.subtitle },
          { field: 'Content', before: editingNotice.content, after: payload.content },
          { field: 'External Link', before: editingNotice.external_link, after: payload.external_link },
          { field: 'Show in Banner', before: editingNotice.show_in_carousel, after: payload.show_in_carousel },
          { field: 'Pinned Notice', before: editingNotice.is_pinned, after: payload.is_pinned },
        ]);
        void recordEditHistory({
          actor: profile,
          category: 'Activities',
          table: 'announcements',
          recordId: editingNotice.id,
          recordTitle: payload.title,
          changes,
        });
      } else {
        await supabase.from('announcements').insert(payload);
        void emitClubNotification({
          targetUserId: null,
          type: 'announcement',
          title: `New Announcement: ${payload.title}`,
          body: payload.content ? payload.content.slice(0, 140) : payload.subtitle || 'Check club notices.',
          targetTab: 'activities',
          actorName: profile.full_name,
        });
      }
      setPosterFile(null);
      setEditingNotice(null);
      setShowNoticeModal(false);
      onRefresh(editingNotice ? 'Poster updated!' : 'Poster published!');
    } finally {
      setSavingNotice(false);
    }
  };

  const openEditPollModal = (poll: Poll) => {
    setEditingPoll(poll);
    setPollQuestion(cleanPollQuestion(poll.question));
    setPollOptionsText((poll.options || []).join('\n'));
    setNewPollShowNumbers(!isPollNumbersHidden(poll));
    setShowPollModal(true);
  };

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const opts = pollOptionsText.split('\n').map((s) => s.trim()).filter(Boolean);
    if (!pollQuestion.trim() || opts.length < 2) return;
    const cleanQ = pollQuestion.trim();
    if (editingPoll) {
      await supabase
        .from('polls')
        .update({ question: cleanQ, options: opts, show_results: newPollShowNumbers })
        .eq('id', editingPoll.id);
      const changes = computeFieldChanges([
        { field: 'Question', before: cleanPollQuestion(editingPoll.question), after: cleanQ },
        { field: 'Options', before: (editingPoll.options || []).join(', '), after: opts.join(', ') },
        { field: 'Show Live Numbers', before: !isPollNumbersHidden(editingPoll), after: newPollShowNumbers },
      ]);
      void recordEditHistory({
        actor: profile,
        category: 'Activities',
        table: 'polls',
        recordId: editingPoll.id,
        recordTitle: cleanQ,
        changes,
      });
      setEditingPoll(null);
      setPollQuestion('');
      setShowPollModal(false);
      onRefresh('Poll updated!');
      return;
    }
    await supabase
      .from('polls')
      .insert({ question: cleanQ, options: opts, show_results: newPollShowNumbers, is_active: true, created_by: profile.full_name });
    void emitClubNotification({
      targetUserId: null,
      type: 'poll',
      title: `New Poll: ${cleanQ}`,
      body: `${opts.length} options — cast your vote now!`,
      targetTab: 'activities',
      actorName: profile.full_name,
    });
    setPollQuestion(''); setShowPollModal(false); onRefresh('Poll published!');
  };

  const activeSlide = carouselSlides.length > 0 ? carouselSlides[currentSlide % carouselSlides.length] : null;

  return (
    <div className="space-y-6">
      {activeSlide && (
        <div className="relative rounded-3xl overflow-hidden shadow-xl bg-slate-950 group border border-white/10">
          <div onClick={() => setSelectedPoster(activeSlide)} className="relative h-[280px] sm:h-[340px] w-full cursor-pointer overflow-hidden">
            <img src={activeSlide.poster_url} alt={activeSlide.title} className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent" />
            <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap justify-between items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase bg-emerald-600/90 text-white backdrop-blur-md"><Bookmark className="w-3 h-3 text-amber-200" /><span>{activeSlide.subtitle || 'Featured'}</span></span>
              <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isAdmin && (
                  <>
                    <button type="button" onClick={() => setHistoryTarget({ table: 'announcements', recordId: activeSlide.id, title: activeSlide.title })} className="p-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white shadow-md cursor-pointer" title="History">
                      <History className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => openEditPosterModal(activeSlide)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 shadow-md cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" /><span>Edit Poster</span>
                    </button>
                    <button type="button" onClick={async () => { await softDeleteRecord({ actor: profile, category: 'Activities', table: 'announcements', recordId: activeSlide.id, recordTitle: activeSlide.title }); onRefresh('Poster hidden from web (kept in Supabase).'); }} className="p-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white shadow-md cursor-pointer" title="Delete from web (kept in Supabase)">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={openCreatePosterModal} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md cursor-pointer">+ Add Poster</button>
                  </>
                )}
                <button type="button" onClick={() => setSelectedPoster(activeSlide)} className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white/15 text-white backdrop-blur-md cursor-pointer"><Maximize2 className="w-3.5 h-3.5 inline mr-1" />View</button>
              </div>
            </div>
            <div className="absolute bottom-5 left-6 right-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div className="max-w-2xl">
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">{activeSlide.title}</h2>
                <p className="text-xs sm:text-sm text-slate-200 line-clamp-2 mt-1">{activeSlide.content}</p>
              </div>
              {activeSlide.external_link && (
                <a href={activeSlide.external_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shrink-0">
                  <span>{activeSlide.link_label || 'Open Link'}</span><ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
          {carouselSlides.length > 1 && (
            <>
              <button type="button" onClick={() => setCurrentSlide((p) => (p - 1 + carouselSlides.length) % carouselSlides.length)} className="absolute left-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 text-white cursor-pointer"><ChevronLeft className="w-5 h-5" /></button>
              <button type="button" onClick={() => setCurrentSlide((p) => (p + 1) % carouselSlides.length)} className="absolute right-3 top-1/2 -translate-y-1/2 z-20 p-2 rounded-full bg-black/50 text-white cursor-pointer"><ChevronRight className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-slate-900">
        <div className="lg:col-span-7 bg-white/85 backdrop-blur-xl rounded-3xl border border-white/80 p-5 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-extrabold">Announcements</h3></div>
            {isAdmin && <button type="button" onClick={openCreatePosterModal} className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">+ Add</button>}
          </div>
          <div className="space-y-2 max-h-[240px] overflow-y-auto">
            {pinnedNotices.map((n) => (
              <div key={n.id} onClick={() => setSelectedPoster(n)} className="p-3 rounded-2xl bg-slate-50/80 hover:bg-emerald-50/50 border border-slate-200/70 cursor-pointer flex justify-between gap-2 text-xs transition">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5"><Pin className="w-3 h-3 text-emerald-600 shrink-0" /><span>{n.title}</span></div>
                  <p className="text-slate-600 line-clamp-2 mt-0.5">{n.content}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button type="button" onClick={() => setHistoryTarget({ table: 'announcements', recordId: n.id, title: n.title })} className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer" title="History"><History className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={() => openEditPosterModal(n)} className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>
                    <button type="button" onClick={async () => { await softDeleteRecord({ actor: profile, category: 'Activities', table: 'announcements', recordId: n.id, recordTitle: n.title }); onRefresh('Hidden from web (kept in Supabase).'); }} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Delete from web (kept in Supabase)"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white/85 backdrop-blur-xl rounded-3xl border border-white/80 p-5 space-y-3 shadow-xs">
          <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
            <div className="flex items-center gap-2"><BarChart2 className="w-4 h-4 text-emerald-600" /><h3 className="text-sm font-extrabold">Polls</h3></div>
            {isAdmin && <button type="button" onClick={() => { setEditingPoll(null); setPollQuestion(''); setPollOptionsText('Option A\nOption B\nOption C'); setNewPollShowNumbers(true); setShowPollModal(true); }} className="px-3 py-1 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">+ New Poll</button>}
          </div>
          <div className="space-y-3 max-h-[240px] overflow-y-auto">
            {polls.map((poll) => {
              const votes = pollVotes.filter((v) => v.poll_id === poll.id);
              const myVote = votes.find((v) => v.user_id === profile.id);
              const hideNumbers = isPollNumbersHidden(poll);
              const canSeeNumbers = !hideNumbers || isAdmin;

              return (
                <div key={poll.id} className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/70 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-slate-900">{cleanPollQuestion(poll.question)}</h4>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => togglePollNumbersVisibility(poll)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer border ${
                            hideNumbers ? 'bg-slate-200 text-slate-700 border-slate-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                          title="Toggle live vote numbers visibility for members"
                        >
                          {hideNumbers ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span>{hideNumbers ? 'Numbers Hidden' : 'Live Numbers'}</span>
                        </button>
                        <button type="button" onClick={() => setHistoryTarget({ table: 'polls', recordId: poll.id, title: cleanPollQuestion(poll.question) })} className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer" title="History"><History className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => openEditPollModal(poll)} className="p-1 text-slate-500 hover:text-slate-900 cursor-pointer" title="Edit Poll"><Edit3 className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={async () => { await softDeleteRecord({ actor: profile, category: 'Activities', table: 'polls', recordId: poll.id, recordTitle: cleanPollQuestion(poll.question) }); onRefresh('Poll hidden from web (kept in Supabase).'); }} className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer" title="Delete from web (kept in Supabase)"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(poll.options || []).map((opt, idx) => {
                      const count = votes.filter((v) => v.option_index === idx).length;
                      const pct = votes.length > 0 ? Math.round((count / votes.length) * 100) : 0;
                      const isMine = myVote?.option_index === idx;
                      return (
                        <button
                          type="button"
                          key={idx}
                          onClick={async () => {
                            await supabase.from('poll_votes').upsert({ poll_id: poll.id, user_id: profile.id, voter_name: profile.full_name, option_index: idx }, { onConflict: 'poll_id,user_id' });
                            onRefresh('Vote recorded!');
                          }}
                          className={`w-full text-left relative overflow-hidden rounded-xl border p-2.5 transition cursor-pointer ${isMine ? 'border-emerald-600 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                        >
                          {canSeeNumbers && <div className="absolute inset-y-0 left-0 bg-emerald-500/15 transition-all" style={{ width: `${pct}%` }} />}
                          <div className="relative flex justify-between items-center font-semibold">
                            <span className="flex items-center gap-1.5">{isMine && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}{opt}</span>
                            {canSeeNumbers && (
                              <span className="text-[11px] font-mono text-slate-500">
                                {pct}% ({count})
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span>{canSeeNumbers ? `${votes.length} vote(s)` : 'Live count hidden'}</span>
                    {hideNumbers && isAdmin && <span>(Visible to Admin only)</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ModalShell
        open={Boolean(selectedPoster)}
        onClose={() => setSelectedPoster(null)}
        zIndexClass="z-[70]"
        maxWidthClass="max-w-3xl"
        backdropClassName="bg-slate-950/85 backdrop-blur-xs"
        ariaLabel={selectedPoster?.title || 'Spotlight Poster'}
      >
        {selectedPoster && (
          <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10 grid grid-cols-1 md:grid-cols-2">
            <div className="bg-slate-950 flex items-center justify-center max-h-[450px]"><img src={selectedPoster.poster_url} alt={selectedPoster.title} className="w-full h-full object-contain" /></div>
            <div className="p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">{selectedPoster.subtitle || 'Spotlight'}</span>
                  <div className="flex items-center gap-1.5">
                    {isAdmin && (
                      <button type="button" onClick={() => openEditPosterModal(selectedPoster)} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
                        <Edit3 className="w-3.5 h-3.5" /><span>Edit</span>
                      </button>
                    )}
                    <button type="button" onClick={() => setSelectedPoster(null)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                </div>
                <h2 className="text-lg font-extrabold">{selectedPoster.title}</h2>
                <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line">{selectedPoster.content}</p>
              </div>
              {selectedPoster.external_link && (
                <a href={selectedPoster.external_link} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white text-center">
                  {selectedPoster.link_label || 'Open Link'} <ExternalLink className="w-3.5 h-3.5 inline ml-1" />
                </a>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={showNoticeModal}
        onClose={() => setShowNoticeModal(false)}
        zIndexClass="z-[70]"
        maxWidthClass="max-w-lg"
        ariaLabel={editingNotice ? 'Edit Poster / Notice' : 'Publish Poster / Notice'}
      >
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex justify-between items-center border-b border-white/10"><h3 className="text-sm font-bold">{editingNotice ? 'Edit Poster / Notice' : 'Publish Poster / Notice'}</h3><button type="button" onClick={() => setShowNoticeModal(false)} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X className="w-4 h-4" /></button></div>
          <form onSubmit={handleSaveNotice} className="p-6 space-y-3 text-xs">
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Headline *" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold" required />
            <input type="text" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Badge text" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" />
            <textarea rows={3} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Details *" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" required />
            <input type="file" accept="image/*" onChange={(e) => setPosterFile(e.target.files?.[0] || null)} className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer" />
            <input type="url" value={posterUrl} onChange={(e) => setPosterUrl(e.target.value)} placeholder="Or Paste Image URL" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" />
            <div className="grid grid-cols-2 gap-2">
              <input type="url" value={externalLink} onChange={(e) => setExternalLink(e.target.value)} placeholder="External Link" className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" />
              <input type="text" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} placeholder="Button Label" className="rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={showInCarousel} onChange={(e) => setShowInCarousel(e.target.checked)} />Show in Banner</label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer"><input type="checkbox" checked={isPinned} onChange={(e) => setIsPinned(e.target.checked)} />Pin to Notices</label>
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowNoticeModal(false)} className="px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">Cancel</button><button type="submit" disabled={savingNotice} className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">{savingNotice ? 'Saving...' : editingNotice ? 'Save Changes' : 'Publish'}</button></div>
          </form>
        </div>
      </ModalShell>

      <ModalShell
        open={showPollModal}
        onClose={() => {
          setShowPollModal(false);
          setEditingPoll(null);
        }}
        zIndexClass="z-[70]"
        maxWidthClass="max-w-md"
        ariaLabel={editingPoll ? 'Edit Poll' : 'Create Poll'}
      >
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex justify-between items-center border-b border-white/10"><h3 className="text-sm font-bold">{editingPoll ? 'Edit Poll' : 'Create Poll'}</h3><button type="button" onClick={() => { setShowPollModal(false); setEditingPoll(null); }} className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"><X className="w-4 h-4" /></button></div>
          <form onSubmit={handleCreatePoll} className="p-6 space-y-3 text-xs">
            <input type="text" value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Question *" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-bold" required />
            <textarea rows={4} value={pollOptionsText} onChange={(e) => setPollOptionsText(e.target.value)} placeholder="1 option per line *" className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-slate-950 px-3 py-2" required />
            <label className="flex items-center gap-2 font-bold pt-1 cursor-pointer">
              <input type="checkbox" checked={newPollShowNumbers} onChange={(e) => setNewPollShowNumbers(e.target.checked)} />
              <span>Show live vote numbers to members</span>
            </label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => { setShowPollModal(false); setEditingPoll(null); }} className="px-4 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">Cancel</button><button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">{editingPoll ? 'Save Changes' : 'Publish'}</button></div>
          </form>
        </div>
      </ModalShell>

      <RecordHistoryModal
        target={historyTarget}
        logs={logs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}