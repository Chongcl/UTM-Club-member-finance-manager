'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  supabase,
  UserProfile,
  Budget,
  EventRsvp,
  ActivityFeePayment,
  DEFAULT_DEPARTMENTS,
  MAX_FILE_SIZE_BYTES,
  downloadFileFromUrl,
} from '@/lib/supabase';
import {
  User,
  UserCheck,
  Save,
  CheckCircle2,
  Loader2,
  Calendar,
  Car,
  ExternalLink,
  Landmark,
  Download,
  Trash2,
  FileText,
  AlertCircle,
  Mail,
  KeyRound,
  Lock,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  LogOut,
  Upload,
  Sparkles,
  QrCode,
  CreditCard,
  X,
  RotateCcw,
  Crown,
  MapPin,
  Receipt,
  Check,
  ZoomIn,
} from 'lucide-react';

type ProfileTab = 'personal' | 'payout' | 'security' | 'activity';

interface ProfileSectionProps {
  profile: UserProfile;
  departments?: string[];
  budgets: Budget[];
  myRsvps: EventRsvp[];
  myFeePayments: ActivityFeePayment[];
  onUpdated: (updated: Partial<UserProfile>, msg: string) => void;
  onSignOut?: () => Promise<void>;
}

function getInitials(name?: string): string {
  const cleaned = (name || '').trim();
  if (!cleaned) return 'CS';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
}

function formatReadableDate(raw?: string | null): string {
  if (!raw) return '';
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return raw;
  return dt.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function evaluatePasswordStrength(pw: string): {
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  bars: number;
  textClass: string;
  barClass: string;
} {
  if (!pw) {
    return {
      label: 'Weak',
      bars: 0,
      textClass: 'text-slate-400',
      barClass: 'bg-slate-200',
    };
  }
  let score = 0;
  if (pw.length >= 6) score += 1;
  if (pw.length >= 10) score += 1;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score += 1;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score += 1;

  if (score <= 1) {
    return {
      label: 'Weak',
      bars: 1,
      textClass: 'text-rose-600',
      barClass: 'bg-rose-500',
    };
  }
  if (score === 2) {
    return {
      label: 'Fair',
      bars: 2,
      textClass: 'text-amber-600',
      barClass: 'bg-amber-500',
    };
  }
  if (score === 3) {
    return {
      label: 'Good',
      bars: 3,
      textClass: 'text-teal-600',
      barClass: 'bg-teal-500',
    };
  }
  return {
    label: 'Strong',
    bars: 4,
    textClass: 'text-emerald-600',
    barClass: 'bg-emerald-500',
  };
}

export default function ProfileSection({
  profile,
  departments = DEFAULT_DEPARTMENTS,
  budgets,
  myRsvps,
  myFeePayments,
  onUpdated,
  onSignOut,
}: ProfileSectionProps) {
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

  // Personal & Academic state
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [matricNo, setMatricNo] = useState(profile.matric_no || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '');
  const [memberType, setMemberType] = useState(
    profile.member_type || departments[0] || 'Ordinary Member'
  );
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study || 'Year 1');
  const [course, setCourse] = useState(profile.course || '');
  const [icNo, setIcNo] = useState(profile.ic_no || '');
  const [showIc, setShowIc] = useState(false);
  const [dormitory, setDormitory] = useState(profile.dormitory || '');
  const [hometown, setHometown] = useState(profile.hometown || '');
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Payout & Bank QR state
  const [bankName, setBankName] = useState(profile.bank_name || '');
  const [bankAccountNo, setBankAccountNo] = useState(profile.bank_account_no || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(
    profile.bank_account_holder || profile.full_name || ''
  );
  const [bankQrUrl, setBankQrUrl] = useState(profile.bank_qr_url || '');
  const [bankQrFile, setBankQrFile] = useState<File | null>(null);
  const [localBankQrPreviewUrl, setLocalBankQrPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [savingPayout, setSavingPayout] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [qrZoomSrc, setQrZoomSrc] = useState<string | null>(null);
  const qrInputRef = useRef<HTMLInputElement>(null);

  // Security & Preferences state
  const [allowWhatsappChat, setAllowWhatsappChat] = useState(
    Boolean(profile.allow_whatsapp_chat)
  );
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [pendingNewEmail, setPendingNewEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  // Change Email Modal state
  const [changeEmailOpen, setChangeEmailOpen] = useState(false);
  const [newEmailInput, setNewEmailInput] = useState('');
  const [emailCurrentPw, setEmailCurrentPw] = useState('');
  const [showEmailPw, setShowEmailPw] = useState(false);
  const [emailModalSaving, setEmailModalSaving] = useState(false);
  const [emailModalError, setEmailModalError] = useState<string | null>(null);
  const [emailModalSentTo, setEmailModalSentTo] = useState<string | null>(null);

  // Reset Password Modal state
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [currentPwInput, setCurrentPwInput] = useState('');
  const [newPwInput, setNewPwInput] = useState('');
  const [confirmPwInput, setConfirmPwInput] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [pwModalSaving, setPwModalSaving] = useState(false);
  const [pwModalError, setPwModalError] = useState<string | null>(null);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetLinkNotice, setResetLinkNotice] = useState<string | null>(null);

  useEffect(() => {
    if (
      !bankQrFile ||
      bankQrFile.type === 'application/pdf' ||
      bankQrFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setLocalBankQrPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(bankQrFile);
    setLocalBankQrPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [bankQrFile]);

  useEffect(() => {
    setFullName(profile.full_name || '');
    setMatricNo(profile.matric_no || '');
    setPhoneNumber(profile.phone_number || '');
    setMemberType(profile.member_type || departments[0] || 'Ordinary Member');
    setYearOfStudy(profile.year_of_study || 'Year 1');
    setCourse(profile.course || '');
    setIcNo(profile.ic_no || '');
    setDormitory(profile.dormitory || '');
    setHometown(profile.hometown || '');
    setBankName(profile.bank_name || '');
    setBankAccountNo(profile.bank_account_no || '');
    setBankAccountHolder(profile.bank_account_holder || profile.full_name || '');
    setBankQrUrl(profile.bank_qr_url || '');
    setAllowWhatsappChat(Boolean(profile.allow_whatsapp_chat));
  }, [profile, departments]);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      const pending = (data.user as { new_email?: string | null } | null)?.new_email;
      if (pending && pending.toLowerCase() !== (profile.email || '').toLowerCase()) {
        setPendingNewEmail(pending);
      } else {
        setPendingNewEmail(null);
      }
    });
    return () => {
      active = false;
    };
  }, [profile.email, changeEmailOpen]);

  useEffect(() => {
    if (!changeEmailOpen && !resetPwOpen && !qrZoomSrc) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setChangeEmailOpen(false);
        setResetPwOpen(false);
        setQrZoomSrc(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [changeEmailOpen, resetPwOpen, qrZoomSrc]);

  const attendingCount = useMemo(
    () => myRsvps.filter((r) => r.attendance === 'Attending').length,
    [myRsvps]
  );

  const profileCompleteness = useMemo(() => {
    const checks = [
      Boolean((fullName || '').trim()),
      Boolean((matricNo || '').trim()),
      Boolean((phoneNumber || '').trim()),
      Boolean((memberType || '').trim()),
      Boolean((yearOfStudy || '').trim()),
      Boolean((course || '').trim()),
      Boolean((icNo || '').trim()),
      Boolean((dormitory || '').trim()),
      Boolean((hometown || '').trim()),
      Boolean(((bankName || '').trim() && (bankAccountNo || '').trim()) || (bankQrUrl || '').trim()),
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, [
    fullName,
    matricNo,
    phoneNumber,
    memberType,
    yearOfStudy,
    course,
    icNo,
    dormitory,
    hometown,
    bankName,
    bankAccountNo,
    bankQrUrl,
  ]);

  const isPersonalDirty = useMemo(() => {
    return (
      fullName.trim() !== (profile.full_name || '').trim() ||
      matricNo.trim().toUpperCase() !== (profile.matric_no || '').trim().toUpperCase() ||
      phoneNumber.trim() !== (profile.phone_number || '').trim() ||
      memberType !== (profile.member_type || departments[0] || 'Ordinary Member') ||
      yearOfStudy !== (profile.year_of_study || 'Year 1') ||
      course.trim() !== (profile.course || '').trim() ||
      icNo.trim() !== (profile.ic_no || '').trim() ||
      dormitory.trim() !== (profile.dormitory || '').trim() ||
      hometown.trim() !== (profile.hometown || '').trim()
    );
  }, [
    fullName,
    matricNo,
    phoneNumber,
    memberType,
    yearOfStudy,
    course,
    icNo,
    dormitory,
    hometown,
    profile,
    departments,
  ]);

  const isPayoutDirty = useMemo(() => {
    return (
      bankName.trim() !== (profile.bank_name || '').trim() ||
      bankAccountNo.trim() !== (profile.bank_account_no || '').trim() ||
      bankAccountHolder.trim() !== (profile.bank_account_holder || profile.full_name || '').trim() ||
      bankQrUrl.trim() !== (profile.bank_qr_url || '').trim() ||
      Boolean(bankQrFile)
    );
  }, [bankName, bankAccountNo, bankAccountHolder, bankQrUrl, bankQrFile, profile]);

  const handleDiscardPersonal = () => {
    setFullName(profile.full_name || '');
    setMatricNo(profile.matric_no || '');
    setPhoneNumber(profile.phone_number || '');
    setMemberType(profile.member_type || departments[0] || 'Ordinary Member');
    setYearOfStudy(profile.year_of_study || 'Year 1');
    setCourse(profile.course || '');
    setIcNo(profile.ic_no || '');
    setDormitory(profile.dormitory || '');
    setHometown(profile.hometown || '');
    setPersonalError(null);
  };

  const handleSavePersonal = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalError(null);
    setSavingPersonal(true);
    try {
      const coreUpdates: Partial<UserProfile> = {
        full_name: fullName.trim(),
        matric_no: matricNo.trim().toUpperCase(),
        phone_number: phoneNumber.trim(),
        member_type: memberType,
        year_of_study: yearOfStudy,
        course: course.trim(),
        ic_no: icNo.trim(),
        dormitory: dormitory.trim(),
        hometown: hometown.trim(),
      };
      const { error } = await supabase.from('users').update(coreUpdates).eq('id', profile.id);
      if (error) {
        setPersonalError(error.message || 'Could not save personal details.');
        return;
      }
      onUpdated(coreUpdates, 'Personal & academic profile saved!');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleQrFileSelected = (file: File | null) => {
    setPayoutError(null);
    if (!file) {
      setBankQrFile(null);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setPayoutError('QR file must be under 50 MB.');
      return;
    }
    const isImageOrPdf =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      /\.(png|jpe?g|webp|gif|pdf)$/i.test(file.name);
    if (!isImageOrPdf) {
      setPayoutError('Unsupported file format. Please upload JPG, PNG, or PDF.');
      return;
    }
    setBankQrFile(file);
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    setSavingPayout(true);
    try {
      let finalQrUrl = bankQrUrl.trim();
      if (bankQrFile) {
        if (bankQrFile.size > MAX_FILE_SIZE_BYTES) {
          setPayoutError('QR file must be under 50 MB.');
          return;
        }
        const ext = bankQrFile.name.split('.').pop() || 'png';
        const path = `member-qr/${profile.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, bankQrFile);
        if (upErr) {
          setPayoutError(upErr.message || 'Could not upload QR file. Please try again.');
          return;
        }
        finalQrUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      }

      const bankData: Partial<UserProfile> = {
        bank_name: bankName.trim(),
        bank_account_no: bankAccountNo.trim(),
        bank_account_holder: bankAccountHolder.trim() || fullName.trim() || profile.full_name,
        bank_qr_url: finalQrUrl,
      };

      const { error } = await supabase.from('users').update(bankData).eq('id', profile.id);
      if (error) {
        setPayoutError(error.message || 'Could not save bank & QR details.');
        return;
      }

      setBankQrUrl(finalQrUrl);
      setBankQrFile(null);
      onUpdated(bankData, 'Bank & Reimbursement QR saved!');
    } finally {
      setSavingPayout(false);
    }
  };

  const handleToggleWhatsapp = async () => {
    if (savingWhatsapp) return;
    const nextVal = !allowWhatsappChat;
    setAllowWhatsappChat(nextVal);
    setSavingWhatsapp(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ allow_whatsapp_chat: nextVal })
        .eq('id', profile.id);
      if (error) {
        setAllowWhatsappChat(!nextVal);
        onUpdated({}, error.message || 'Could not update chat preference.');
        return;
      }
      onUpdated(
        { allow_whatsapp_chat: nextVal },
        nextVal ? 'WhatsApp chat link enabled in Club Chat.' : 'WhatsApp chat link disabled.'
      );
    } finally {
      setSavingWhatsapp(false);
    }
  };

  const openChangeEmailModal = () => {
    setNewEmailInput('');
    setEmailCurrentPw('');
    setShowEmailPw(false);
    setEmailModalError(null);
    setEmailModalSentTo(null);
    setChangeEmailOpen(true);
  };

  const handleChangeEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailModalError(null);
    const trimmedNewEmail = newEmailInput
      .replace(/[\u200B-\u200D\uFEFF]/g, '')
      .trim()
      .toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedNewEmail)) {
      setEmailModalError('Please enter a valid email address.');
      return;
    }
    if (trimmedNewEmail === (profile.email || '').trim().toLowerCase()) {
      setEmailModalError('New email must differ from your current email address.');
      return;
    }
    if (!emailCurrentPw) {
      setEmailModalError('Please enter your current password to verify your identity.');
      return;
    }

    setEmailModalSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentAuthEmail = userData.user?.email || profile.email;
      if (!currentAuthEmail) {
        setEmailModalError('Unable to verify current account email.');
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentAuthEmail,
        password: emailCurrentPw,
      });
      if (signInErr) {
        setEmailModalError('Incorrect current password.');
        return;
      }

      const { data, error } = await supabase.auth.updateUser({ email: trimmedNewEmail });
      if (error) {
        const { data: rpcRes, error: rpcErr } = await supabase.rpc('change_my_email', {
          p_new_email: trimmedNewEmail,
        });
        if (!rpcErr && rpcRes && typeof rpcRes === 'object') {
          const resObj = rpcRes as { ok?: boolean; email?: string; error?: string };
          if (resObj.ok) {
            const finalEmail = (resObj.email || trimmedNewEmail).trim();
            await supabase.auth.refreshSession();
            setPendingNewEmail(null);
            setChangeEmailOpen(false);
            onUpdated({ email: finalEmail }, 'Email updated successfully!');
            return;
          }
          if (resObj.error) {
            setEmailModalError(resObj.error);
            return;
          }
        }
        setEmailModalError(error.message || 'Could not update email address.');
        return;
      }

      const updatedEmail = data.user?.email?.trim() || '';
      if (updatedEmail.toLowerCase() === trimmedNewEmail) {
        await supabase.from('users').update({ email: updatedEmail }).eq('id', profile.id);
        setPendingNewEmail(null);
        setChangeEmailOpen(false);
        onUpdated({ email: updatedEmail }, 'Email updated successfully!');
      } else {
        const pending =
          (data.user as { new_email?: string | null } | null)?.new_email || trimmedNewEmail;
        setPendingNewEmail(pending);
        setEmailModalSentTo(pending);
      }
    } finally {
      setEmailModalSaving(false);
    }
  };

  const openResetPwModal = () => {
    setCurrentPwInput('');
    setNewPwInput('');
    setConfirmPwInput('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setPwModalError(null);
    setResetLinkNotice(null);
    setResetPwOpen(true);
  };

  const handleResetPwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwModalError(null);

    if (!currentPwInput) {
      setPwModalError('Please enter your current password.');
      return;
    }
    if (newPwInput.length < 6) {
      setPwModalError('New password must be at least 6 characters.');
      return;
    }
    if (newPwInput !== confirmPwInput) {
      setPwModalError('New passwords do not match.');
      return;
    }
    if (newPwInput === currentPwInput) {
      setPwModalError('New password must differ from your current password.');
      return;
    }

    setPwModalSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentAuthEmail = userData.user?.email || profile.email;
      if (!currentAuthEmail) {
        setPwModalError('Unable to determine account email.');
        return;
      }

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: currentAuthEmail,
        password: currentPwInput,
      });
      if (signInErr) {
        setPwModalError('Current password is incorrect.');
        return;
      }

      const { error: updErr } = await supabase.auth.updateUser({ password: newPwInput });
      if (updErr) {
        setPwModalError(updErr.message || 'Could not update password.');
        return;
      }

      setCurrentPwInput('');
      setNewPwInput('');
      setConfirmPwInput('');
      setResetPwOpen(false);
      onUpdated({}, 'Password updated successfully!');
    } finally {
      setPwModalSaving(false);
    }
  };

  const handleSendPasswordResetEmail = async () => {
    setPwModalError(null);
    setResetLinkNotice(null);
    setSendingResetLink(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const targetEmail = userData.user?.email || profile.email;
      if (!targetEmail) {
        setPwModalError('No email found for your account.');
        return;
      }
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      });
      if (error) {
        setPwModalError(error.message || 'Failed to send reset link.');
        return;
      }
      setResetLinkNotice(`Password reset link sent to ${targetEmail}. Check your inbox.`);
    } finally {
      setSendingResetLink(false);
    }
  };

  const pwStrength = evaluatePasswordStrength(newPwInput);
  const roleAvatarStyle =
    profile.role === 'owner'
      ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-amber-500/20'
      : profile.role === 'treasurer'
      ? 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-600/25'
      : 'bg-gradient-to-br from-slate-800 to-emerald-800 text-white shadow-slate-900/20';

  const roleDisplayLabel =
    profile.role === 'owner' ? 'Owner' : profile.role === 'treasurer' ? 'Admin' : 'Member';

  const ringRadius = 17;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - profileCompleteness / 100);

  const tabs: { id: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { id: 'personal', label: 'Personal & Academic', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'payout', label: 'Payout & Bank QR', icon: <CreditCard className="w-3.5 h-3.5" /> },
    { id: 'security', label: 'Account & Security', icon: <Shield className="w-3.5 h-3.5" /> },
    { id: 'activity', label: 'My Activity', icon: <Calendar className="w-3.5 h-3.5" /> },
  ];

  const isPdfQr = bankQrFile
    ? bankQrFile.type === 'application/pdf' || bankQrFile.name.toLowerCase().endsWith('.pdf')
    : bankQrUrl.toLowerCase().split('?')[0].endsWith('.pdf');
  const qrPreviewSrc = bankQrFile ? localBankQrPreviewUrl : bankQrUrl || null;

  return (
    <div className="space-y-5">
      {/* Top Identity Hero Card */}
      <section className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />
        <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          {/* Left Identity Summary */}
          <div className="flex items-start sm:items-center gap-4 min-w-0">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-lg shrink-0 ${roleAvatarStyle}`}
            >
              {getInitials(profile.full_name)}
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 truncate">
                  {profile.full_name || 'Club Member'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide ${
                    profile.role === 'owner'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300/70'
                      : profile.role === 'treasurer'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300/70'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  {profile.role === 'owner' && <Crown className="w-3 h-3" />}
                  {roleDisplayLabel}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {profile.matric_no && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white font-mono font-bold text-[11px]">
                    {profile.matric_no}
                  </span>
                )}
                {profile.member_type && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200/80 font-bold text-[11px]">
                    {profile.member_type}
                  </span>
                )}
                {profile.batch_year && (
                  <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 font-semibold text-[11px]">
                    Batch {profile.batch_year}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate font-medium text-slate-700">{profile.email}</span>
                <button
                  type="button"
                  onClick={() => setActiveTab('security')}
                  className="text-[11px] font-bold text-emerald-700 hover:text-emerald-600 underline underline-offset-2 cursor-pointer"
                >
                  Security &amp; Email
                </button>
              </div>
            </div>
          </div>

          {/* Right Mini Metrics */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3.5 py-2.5 flex flex-col justify-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Attending
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                {attendingCount}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Events</div>
            </div>

            <div className="rounded-2xl bg-slate-50/90 border border-slate-200/80 px-3.5 py-2.5 flex flex-col justify-center">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Receipts
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">
                {myFeePayments.length}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Submitted</div>
            </div>

            <div className="rounded-2xl bg-emerald-50/70 border border-emerald-200/80 px-3 py-2.5 flex items-center gap-2.5">
              <div className="relative w-11 h-11 shrink-0 hidden sm:flex items-center justify-center">
                <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                  <circle
                    cx="22"
                    cy="22"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="text-emerald-200/70"
                  />
                  <circle
                    cx="22"
                    cy="22"
                    r={ringRadius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    className="text-emerald-600 transition-all duration-500"
                  />
                </svg>
                <span className="absolute text-[10px] font-extrabold text-emerald-900">
                  {profileCompleteness}%
                </span>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                  Profile
                </div>
                <div className="text-lg sm:text-base font-extrabold text-emerald-950 sm:hidden">
                  {profileCompleteness}%
                </div>
                <div className="text-[11px] font-bold text-emerald-900 leading-tight hidden sm:block">
                  {profileCompleteness === 100 ? 'Complete' : 'Add dorm/QR'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Segmented Tab Bar */}
        <div className="px-5 sm:px-6 pb-4 pt-1 border-t border-slate-100 bg-slate-50/50">
          <div
            className="flex items-center gap-1.5 overflow-x-auto py-1"
            role="tablist"
            aria-label="Profile sections"
          >
            {tabs.map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                    selected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                  {tab.id === 'personal' && isPersonalDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved edits" />
                  )}
                  {tab.id === 'payout' && isPayoutDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Unsaved edits" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* TAB 1: PERSONAL & ACADEMIC */}
      {activeTab === 'personal' && (
        <form onSubmit={handleSavePersonal} className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Identity & Contact Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Identity &amp; Contact</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Used to auto-fill attendance passes, event registrations, and claims.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Matric No *</label>
                    <input
                      type="text"
                      value={matricNo}
                      onChange={(e) => setMatricNo(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono uppercase text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Phone / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700">IC / Passport No</label>
                    <span className="text-[10px] text-slate-400">
                      Masked by default for privacy
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type={showIc ? 'text' : 'password'}
                      value={icNo}
                      onChange={(e) => setIcNo(e.target.value)}
                      placeholder="e.g., 040101-01-1234"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 pr-10 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowIc((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label={showIc ? 'Hide IC number' : 'Reveal IC number'}
                      title={showIc ? 'Hide IC / Passport No' : 'Show IC / Passport No'}
                    >
                      {showIc ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Campus & Club Info Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
              <div className="flex items-start gap-3 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">Campus &amp; Club Info</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Helps organize department rosters, academic batch records, and carpools.
                  </p>
                </div>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Department / Unit *
                    </label>
                    <select
                      value={memberType}
                      onChange={(e) => setMemberType(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      {departments.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Year of Study</label>
                    <select
                      value={yearOfStudy}
                      onChange={(e) => setYearOfStudy(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    >
                      {['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate'].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Faculty / Course Code
                  </label>
                  <input
                    type="text"
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g., FSKSM / SECJ"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Residential College / Dormitory
                    </label>
                    <input
                      type="text"
                      value={dormitory}
                      onChange={(e) => setDormitory(e.target.value)}
                      placeholder="e.g., KTDI / KTR / KTHO"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Auto-fills your pickup dorm for event carpools
                    </p>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Hometown</label>
                    <input
                      type="text"
                      value={hometown}
                      onChange={(e) => setHometown(e.target.value)}
                      placeholder="e.g., George Town, Penang"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {personalError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{personalError}</span>
            </div>
          )}

          {/* Save Bar */}
          <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/80 shadow-sm px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs">
              {isPersonalDirty ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Unsaved changes
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-slate-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  All personal &amp; academic details up to date
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isPersonalDirty && (
                <button
                  type="button"
                  onClick={handleDiscardPersonal}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Discard</span>
                </button>
              )}
              <button
                type="submit"
                disabled={savingPersonal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer disabled:opacity-60"
              >
                {savingPersonal ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: PAYOUT & BANK QR */}
      {activeTab === 'payout' && (
        <form
          onSubmit={handleSavePayout}
          className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-6"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Payout &amp; Bank / DuitNow QR
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Optional — pre-fills your reimbursement claims so the Treasurer can pay you back quickly.
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold self-start sm:self-center">
              <Sparkles className="w-3 h-3 text-emerald-600" />
              Optional Profile Payout
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left/Top: Bank Inputs + Preview Strip */}
            <div className="lg:col-span-7 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Bank / eWallet Name</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Maybank / CIMB / Bank Islam / TNG eWallet"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Account No / DuitNow Phone
                  </label>
                  <input
                    type="text"
                    value={bankAccountNo}
                    onChange={(e) => setBankAccountNo(e.target.value)}
                    placeholder="e.g., 162106789012"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Recipient Holder Name
                  </label>
                  <input
                    type="text"
                    value={bankAccountHolder}
                    onChange={(e) => setBankAccountHolder(e.target.value)}
                    placeholder={fullName || 'Account Holder Name'}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Subtle Live Treasurer Payout Preview */}
              <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2 border border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-400">
                    Treasurer Payout Preview
                  </span>
                  <span className="text-[10px] text-slate-400">Shown on approved claims</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-xs">
                  <div>
                    <div className="text-[10px] text-slate-400">Bank / eWallet</div>
                    <div className="font-bold truncate">{bankName.trim() || 'Not specified'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Account / DuitNow</div>
                    <div className="font-mono font-bold truncate">
                      {bankAccountNo.trim() || 'Not specified'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400">Account Holder</div>
                    <div className="font-bold truncate">
                      {bankAccountHolder.trim() || fullName.trim() || 'Not specified'}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right/Bottom: Personal DuitNow / TNG QR Uploader */}
            <div className="lg:col-span-5 space-y-3 text-xs">
              <label className="block font-bold text-slate-700">
                Personal DuitNow / TNG QR (JPG, PNG, PDF · max 50MB)
              </label>

              <input
                ref={qrInputRef}
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => handleQrFileSelected(e.target.files?.[0] || null)}
                className="hidden"
              />

              <div
                onClick={() => qrInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  handleQrFileSelected(e.dataTransfer.files?.[0] || null);
                }}
                className={`rounded-2xl border-2 border-dashed p-5 text-center transition cursor-pointer ${
                  dragActive
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-300 hover:border-emerald-400 bg-slate-50/70'
                }`}
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs text-emerald-700 flex items-center justify-center mx-auto mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="font-extrabold text-slate-800">
                  Click or drag QR image / PDF here
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  High-contrast DuitNow or TNG QR works best
                </div>
              </div>

              {(bankQrFile || bankQrUrl) && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                  {isPdfQr ? (
                    <div className="w-28 h-28 rounded-xl border border-emerald-200 bg-emerald-50 flex flex-col items-center justify-center text-emerald-800 shrink-0">
                      <FileText className="w-8 h-8" />
                      <span className="text-[10px] font-extrabold mt-1">PDF QR</span>
                    </div>
                  ) : qrPreviewSrc ? (
                    <button
                      type="button"
                      onClick={() => setQrZoomSrc(qrPreviewSrc)}
                      className="relative group w-28 h-28 rounded-xl border border-slate-200 bg-white overflow-hidden shrink-0 cursor-zoom-in shadow-2xs"
                      title="Click to enlarge QR"
                    >
                      <img
                        src={qrPreviewSrc}
                        alt="My Payment QR"
                        className="w-full h-full object-contain p-1"
                      />
                      <span className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <ZoomIn className="w-5 h-5" />
                      </span>
                    </button>
                  ) : (
                    <div className="w-28 h-28 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-400 shrink-0">
                      <QrCode className="w-8 h-8" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                    <div className="font-extrabold text-slate-900 truncate">
                      {bankQrFile ? bankQrFile.name : 'Saved Personal QR'}
                    </div>
                    {bankQrFile ? (
                      <div className="text-[11px] text-amber-700 font-semibold">
                        Staged — click Save Changes to upload
                      </div>
                    ) : (
                      <div className="text-[11px] text-emerald-700 font-semibold">
                        Ready for Treasurer payouts
                      </div>
                    )}
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                      {!bankQrFile && bankQrUrl && (
                        <button
                          type="button"
                          onClick={() => downloadFileFromUrl(bankQrUrl, `${matricNo}_Payment_QR`)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setBankQrFile(null);
                          setBankQrUrl('');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {payoutError && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{payoutError}</span>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              {isPayoutDirty ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Unsaved payout changes
                </span>
              ) : (
                <span>Submitting a receipt claim uses these saved payout details by default.</span>
              )}
            </div>
            <button
              type="submit"
              disabled={savingPayout}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer disabled:opacity-60"
            >
              {savingPayout ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: ACCOUNT & SECURITY */}
      {activeTab === 'security' && (
        <section className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden divide-y divide-slate-100">
          <div className="p-5 sm:p-6">
            <h3 className="text-base font-extrabold text-slate-900">Account &amp; Security</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage your sign-in credentials, chat privacy preference, and active session.
            </p>
          </div>

          {/* Row 1: Email Address */}
          <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900">Email Address</div>
                <div className="text-sm font-semibold text-slate-700 truncate mt-0.5">
                  {profile.email}
                </div>
                {pendingNewEmail && (
                  <span className="inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                    Pending verification: {pendingNewEmail}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={openChangeEmailModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold cursor-pointer shrink-0 shadow-2xs"
            >
              <Mail className="w-3.5 h-3.5 text-slate-500" />
              <span>Change Email</span>
            </button>
          </div>

          {/* Row 2: Password */}
          <div className="p-5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900">Password</div>
                <div className="text-sm font-mono tracking-widest text-slate-700 mt-0.5">
                  ••••••••••••
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Keep your ClubSync account secure
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openResetPwModal}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold cursor-pointer shrink-0 shadow-2xs"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset Password</span>
            </button>
          </div>

          {/* Row 3: Chat & Privacy */}
          <div className="p-5 sm:px-6 flex items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900">
                  Allow members to continue chat with me on WhatsApp
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                  Off by default. Your raw phone number is never displayed inside Club Chat — enabling this only lets club members open a direct WhatsApp shortcut from Chat.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={allowWhatsappChat}
              disabled={savingWhatsapp}
              onClick={handleToggleWhatsapp}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-60 ${
                allowWhatsappChat ? 'bg-emerald-600' : 'bg-slate-300'
              }`}
              title="Toggle WhatsApp chat permission"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  allowWhatsappChat ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Row 4: Session */}
          <div className="p-5 sm:px-6 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-white border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-extrabold text-slate-900">Active Session</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  Signed in with account role:{' '}
                  <span className="font-bold text-slate-800">{roleDisplayLabel}</span>
                </div>
              </div>
            </div>
            {onSignOut && (
              <button
                type="button"
                disabled={signingOut}
                onClick={async () => {
                  setSigningOut(true);
                  try {
                    await onSignOut();
                  } finally {
                    setSigningOut(false);
                  }
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-extrabold cursor-pointer shrink-0 disabled:opacity-60"
              >
                {signingOut ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <LogOut className="w-3.5 h-3.5" />
                )}
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* TAB 4: MY ACTIVITY */}
      {activeTab === 'activity' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* My Event RSVPs */}
          <section className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/70 text-emerald-700 flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    My Event RSVPs ({myRsvps.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">Attendance &amp; carpool status</p>
                </div>
              </div>
            </div>

            {myRsvps.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <Calendar className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">No event responses yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRsvps.map((r) => {
                  const ev = budgets.find((b) => b.id === r.budget_id);
                  const transportText = r.is_driver
                    ? `Driver (${r.car_details || 'Vehicle'})`
                    : r.assigned_driver_name
                    ? `Assigned Driver: ${r.assigned_driver_name}`
                    : `Transport: ${r.transport_type || 'None'}`;
                  return (
                    <div
                      key={r.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-2.5 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 truncate">
                            {ev?.event_name || 'Club Activity'}
                          </div>
                          {ev?.event_date && (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {formatReadableDate(ev.event_date)}
                            </div>
                          )}
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold shrink-0 ${
                            r.attendance === 'Attending'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {r.attendance}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700">
                          <Car className="w-3 h-3 text-emerald-600" />
                          {transportText}
                        </span>
                        {r.qr_checked_in && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-[11px] font-bold text-teal-800">
                            <QrCode className="w-3 h-3" />
                            QR Checked-In
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* My Fee Receipts */}
          <section className="bg-white/95 backdrop-blur-xl rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200/70 text-teal-700 flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    My Fee Receipts ({myFeePayments.length})
                  </h3>
                  <p className="text-[11px] text-slate-500">Activity fees &amp; verification status</p>
                </div>
              </div>
            </div>

            {myFeePayments.length === 0 ? (
              <div className="py-10 text-center space-y-1">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-semibold text-slate-500">
                  No fee payments submitted yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {myFeePayments.map((f) => {
                  const ev = budgets.find((b) => b.id === f.budget_id);
                  const statusBadge =
                    f.status === 'Verified'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : f.status === 'Rejected'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200';
                  return (
                    <div
                      key={f.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="font-extrabold text-slate-900 truncate">
                          {ev?.event_name || 'Event Fee'}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-emerald-700">
                            RM {Number(f.amount_paid).toFixed(2)}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${statusBadge}`}>
                            {f.status}
                          </span>
                          {f.created_at && (
                            <span className="text-[11px] text-slate-400">
                              {formatReadableDate(f.created_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {f.receipt_url && (
                        <a
                          href={f.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-300 text-emerald-700 font-bold shrink-0"
                        >
                          <span>View Receipt</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {/* QR IMAGE LIGHTBOX */}
      {qrZoomSrc &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setQrZoomSrc(null)}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  My Payment QR
                </span>
                <button
                  type="button"
                  onClick={() => setQrZoomSrc(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-6 flex items-center justify-center bg-slate-50">
                <img
                  src={qrZoomSrc}
                  alt="Enlarged Payment QR"
                  className="max-h-[60vh] w-auto object-contain rounded-xl bg-white border border-slate-200 p-2"
                />
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* POP-OUT MODAL A: CHANGE EMAIL */}
      {changeEmailOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setChangeEmailOpen(false)}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white text-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">Change Email Address</h3>
                    <p className="text-[11px] text-emerald-100">Update your ClubSync sign-in email</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChangeEmailOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {emailModalSentTo ? (
                <div className="p-6 space-y-4 text-xs">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                    <div className="flex items-center gap-2 font-extrabold text-sm text-emerald-800">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                      <span>Confirmation Email Sent</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      We sent a verification link to{' '}
                      <span className="font-bold text-slate-900">{emailModalSentTo}</span>. Click
                      the link inside that email (and confirm from your current email if prompted)
                      to finalize the change.
                    </p>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setChangeEmailOpen(false)}
                      className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleChangeEmailSubmit} className="p-6 space-y-4 text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500">Current Email</span>
                    <span className="font-mono font-bold text-slate-800 truncate">
                      {profile.email}
                    </span>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">New Email Address</label>
                    <input
                      type="email"
                      value={newEmailInput}
                      onChange={(e) => setNewEmailInput(e.target.value)}
                      placeholder="name@graduate.utm.my"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Current Password</label>
                    <div className="relative">
                      <input
                        type={showEmailPw ? 'text' : 'password'}
                        value={emailCurrentPw}
                        onChange={(e) => setEmailCurrentPw(e.target.value)}
                        placeholder="Verify with current password"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowEmailPw((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        aria-label="Toggle current password visibility"
                      >
                        {showEmailPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {emailModalError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{emailModalError}</span>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setChangeEmailOpen(false)}
                      className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={emailModalSaving}
                      className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-60"
                    >
                      {emailModalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      <span>Update Email</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>,
          document.body
        )}

      {/* POP-OUT MODAL B: RESET / CHANGE PASSWORD */}
      {resetPwOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setResetPwOpen(false)}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white text-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-slate-200"
            >
              <div className="bg-gradient-to-r from-slate-900 to-emerald-900 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                    <KeyRound className="w-4 h-4 text-emerald-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">Reset / Change Password</h3>
                    <p className="text-[11px] text-slate-300">Verify identity &amp; set a strong password</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setResetPwOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleResetPwSubmit} className="p-6 space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPw ? 'text' : 'password'}
                      value={currentPwInput}
                      onChange={(e) => setCurrentPwInput(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Toggle current password visibility"
                    >
                      {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPwInput}
                      onChange={(e) => setNewPwInput(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Toggle new password visibility"
                    >
                      {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Subtle Live Password Strength Bar */}
                  {newPwInput && (
                    <div className="mt-2 space-y-1">
                      <div className="grid grid-cols-4 gap-1">
                        {[1, 2, 3, 4].map((idx) => (
                          <div
                            key={idx}
                            className={`h-1 rounded-full transition-colors ${
                              idx <= pwStrength.bars ? pwStrength.barClass : 'bg-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Password strength</span>
                        <span className={`font-extrabold ${pwStrength.textClass}`}>
                          {pwStrength.label}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPw ? 'text' : 'password'}
                      value={confirmPwInput}
                      onChange={(e) => setConfirmPwInput(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirmPwInput && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-bold">
                      {newPwInput === confirmPwInput ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600">
                          <Check className="w-3.5 h-3.5" />
                          Passwords match
                        </span>
                      ) : (
                        <span className="text-rose-600">Passwords do not match</span>
                      )}
                    </div>
                  )}
                </div>

                {pwModalError && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{pwModalError}</span>
                  </div>
                )}

                {resetLinkNotice && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-semibold">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{resetLinkNotice}</span>
                  </div>
                )}

                <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={sendingResetLink}
                    onClick={handleSendPasswordResetEmail}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-600 underline underline-offset-2 text-left cursor-pointer disabled:opacity-60"
                  >
                    {sendingResetLink
                      ? 'Sending reset link...'
                      : 'Forgot current password? Send reset link to my email'}
                  </button>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetPwOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pwModalSaving}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-60"
                  >
                    {pwModalSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Update Password</span>
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
