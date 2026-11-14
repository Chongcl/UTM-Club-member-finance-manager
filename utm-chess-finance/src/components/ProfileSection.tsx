'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  UserProfile,
  Budget,
  EventRsvp,
  ActivityFeePayment,
  DEFAULT_DEPARTMENTS,
} from '@/lib/supabase';
import {
  UserCheck,
  Save,
  CheckCircle2,
  Loader2,
  Calendar,
  Car,
  ExternalLink,
  Landmark,
} from 'lucide-react';

interface ProfileSectionProps {
  profile: UserProfile;
  departments?: string[];
  budgets: Budget[];
  myRsvps: EventRsvp[];
  myFeePayments: ActivityFeePayment[];
  onUpdated: (updated: Partial<UserProfile>, msg: string) => void;
}

export default function ProfileSection({
  profile,
  departments = DEFAULT_DEPARTMENTS,
  budgets,
  myRsvps,
  myFeePayments,
  onUpdated,
}: ProfileSectionProps) {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [matricNo, setMatricNo] = useState(profile.matric_no || '');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '');
  const [memberType, setMemberType] = useState(
    profile.member_type || departments[0] || 'Ordinary Member'
  );
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study || 'Year 1');
  const [course, setCourse] = useState(profile.course || '');
  const [icNo, setIcNo] = useState(profile.ic_no || '');
  const [dormitory, setDormitory] = useState(profile.dormitory || '');
  const [hometown, setHometown] = useState(profile.hometown || '');
  const [bankName, setBankName] = useState(profile.bank_name || '');
  const [bankAccountNo, setBankAccountNo] = useState(profile.bank_account_no || '');
  const [bankAccountHolder, setBankAccountHolder] = useState(profile.bank_account_holder || profile.full_name || '');
  const [saving, setSaving] = useState(false);

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

    const savedLocal =
      typeof window !== 'undefined'
        ? localStorage.getItem(`clubsync_bank_${profile.id}`)
        : null;
    if (savedLocal) {
      try {
        const parsed = JSON.parse(savedLocal);
        setBankName(profile.bank_name || parsed.bank_name || '');
        setBankAccountNo(profile.bank_account_no || parsed.bank_account_no || '');
        setBankAccountHolder(
          profile.bank_account_holder || parsed.bank_account_holder || profile.full_name || ''
        );
        return;
      } catch {
        /* ignore */
      }
    }
    setBankName(profile.bank_name || '');
    setBankAccountNo(profile.bank_account_no || '');
    setBankAccountHolder(profile.bank_account_holder || profile.full_name || '');
  }, [profile, departments]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const bankData = {
        bank_name: bankName.trim(),
        bank_account_no: bankAccountNo.trim(),
        bank_account_holder: bankAccountHolder.trim() || fullName.trim(),
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem(`clubsync_bank_${profile.id}`, JSON.stringify(bankData));
      }

      const coreUpdates = {
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

      const fullUpdates = { ...coreUpdates, ...bankData };
      const { error } = await supabase.from('users').update(fullUpdates).eq('id', profile.id);
      if (error) {
        await supabase.from('users').update(coreUpdates).eq('id', profile.id);
      }
      onUpdated(fullUpdates, 'Profile & Bank reimbursement details saved!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <UserCheck className="w-5 h-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold">My Member Profile</h2>
              <p className="text-xs text-emerald-200">
                Auto-fills your name, matric, dorm &amp; bank info across events and claims
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-300 text-emerald-950">
            {memberType}
          </span>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Matric No *
              </label>
              <input
                type="text"
                value={matricNo}
                onChange={(e) => setMatricNo(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-mono uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Phone / WhatsApp *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-mono"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Department / Unit *
              </label>
              <select
                value={memberType}
                onChange={(e) => setMemberType(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-bold text-emerald-900"
              >
                {departments.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Residential College / Dormitory
              </label>
              <input
                type="text"
                value={dormitory}
                onChange={(e) => setDormitory(e.target.value)}
                placeholder="e.g., KTDI / KTR / KTHO"
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Year of Study
              </label>
              <select
                value={yearOfStudy}
                onChange={(e) => setYearOfStudy(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm"
              >
                {['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Postgraduate'].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Faculty / Course Code
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                placeholder="e.g., FSKSM / SECJ"
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                IC / Passport No
              </label>
              <input
                type="text"
                value={icNo}
                onChange={(e) => setIcNo(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2">
              <Landmark className="w-4 h-4 text-emerald-700" />
              <div>
                <h3 className="text-xs font-extrabold text-emerald-950">
                  Bank Account / DuitNow / TNG eWallet (Auto-Fills Reimbursement Claims)
                </h3>
                <p className="text-[11px] text-slate-600">
                  Saved here so the Treasurer can reimburse your approved claims in 1 click.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Bank / eWallet Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g., Maybank / CIMB / TNG eWallet"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Account No / DuitNow Phone
                </label>
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  placeholder="e.g., 162106789012 / 012-3456789"
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Recipient Holder Name
                </label>
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder={fullName || 'Account Holder Name'}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>

      <div className="lg:col-span-5 space-y-4">
        <div className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-extrabold text-emerald-950">
              My Event RSVPs ({myRsvps.length})
            </h3>
          </div>
          {myRsvps.length === 0 ? (
            <p className="text-xs text-slate-400">No event responses yet.</p>
          ) : (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {myRsvps.map((r) => {
                const ev = budgets.find((b) => b.id === r.budget_id);
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {ev?.event_name || 'Activity'}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        <Car className="w-3 h-3 inline mr-1" />
                        {r.is_driver
                          ? `Driver (${r.car_details})`
                          : `Transport: ${r.transport_type}`}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-full font-bold bg-emerald-100 text-emerald-800">
                      {r.attendance}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-emerald-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
            <h3 className="text-sm font-extrabold text-emerald-950">
              My Activity Fee Receipts ({myFeePayments.length})
            </h3>
          </div>
          {myFeePayments.length === 0 ? (
            <p className="text-xs text-slate-400">No fee payments submitted yet.</p>
          ) : (
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {myFeePayments.map((f) => {
                const ev = budgets.find((b) => b.id === f.budget_id);
                return (
                  <div
                    key={f.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {ev?.event_name || 'Event Fee'}
                      </p>
                      <p className="text-emerald-700 font-extrabold">
                        RM {Number(f.amount_paid).toFixed(2)} • {f.status}
                      </p>
                    </div>
                    <a
                      href={f.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-bold hover:underline"
                    >
                      Receipt <ExternalLink className="w-3 h-3 inline" />
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}