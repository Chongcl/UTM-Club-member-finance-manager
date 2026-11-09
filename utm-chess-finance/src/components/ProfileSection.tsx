'use client';

import React, { useState } from 'react';
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
  Loader2,
  Home,
  CalendarCheck,
  Car,
  CheckCircle2,
  QrCode,
} from 'lucide-react';

interface ProfileSectionProps {
  profile: UserProfile;
  departments?: string[];
  budgets: Budget[];
  myRsvps: EventRsvp[];
  myFeePayments: ActivityFeePayment[];
  onUpdated: (updated: UserProfile, msg: string) => void;
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
  const [memberType, setMemberType] = useState<string>(
    profile.member_type || departments[0] || 'Member'
  );
  const [dormitory, setDormitory] = useState(profile.dormitory || '');
  const [yearOfStudy, setYearOfStudy] = useState(profile.year_of_study || '');
  const [course, setCourse] = useState(profile.course || '');
  const [hometown, setHometown] = useState(profile.hometown || '');
  const [icNo, setIcNo] = useState(profile.ic_no || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({
          full_name: fullName.trim(),
          matric_no: matricNo.trim().toUpperCase(),
          phone_number: phoneNumber.trim(),
          member_type: memberType,
          dormitory: dormitory.trim(),
          year_of_study: yearOfStudy.trim(),
          course: course.trim(),
          hometown: hometown.trim(),
          ic_no: icNo.trim(),
        })
        .eq('id', profile.id)
        .select('*')
        .single();

      if (error) throw error;
      if (data) {
        await supabase
          .from('event_rsvps')
          .update({ dormitory: dormitory.trim() })
          .eq('user_id', profile.id);

        onUpdated(data as UserProfile, 'Profile & Dormitory Block updated!');
      }
    } finally {
      setSaving(false);
    }
  };

  const attendedCount = myRsvps.filter((r) => r.attendance === 'Attending').length;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-emerald-200 p-6 shadow-xs">
        <div className="flex items-center gap-2.5 pb-4 border-b border-emerald-100">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-emerald-950">
              My Profile, Department &amp; Dormitory Block
            </h2>
            <p className="text-xs text-slate-500">
              Update your department/unit and optional Dormitory Block &amp; No. (e.g., KTDI M17).
            </p>
          </div>
        </div>

        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">Full Name *</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">Matric No. *</label>
              <input type="text" value={matricNo} onChange={(e) => setMatricNo(e.target.value)} className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-mono" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">Phone Number *</label>
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-mono" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">Department / Unit</label>
              <select value={memberType} onChange={(e) => setMemberType(e.target.value)} className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold text-emerald-950">
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-emerald-800 mb-1">
                <Home className="w-3.5 h-3.5 inline mr-1" />
                Dormitory Block (Optional)
              </label>
              <input type="text" value={dormitory} onChange={(e) => setDormitory(e.target.value)} placeholder="e.g., KTDI M17" className="w-full rounded-xl border border-emerald-300 bg-emerald-50/40 px-3 py-2 text-sm font-semibold text-emerald-950" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Year (Optional)</label>
              <select value={yearOfStudy} onChange={(e) => setYearOfStudy(e.target.value)} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm">
                <option value="">-- Select Year --</option>
                <option value="Year 1">Year 1</option>
                <option value="Year 2">Year 2</option>
                <option value="Year 3">Year 3</option>
                <option value="Year 4">Year 4</option>
                <option value="Postgraduate">Postgraduate</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Course (Optional)</label>
              <input type="text" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g., Computer Science" className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Hometown (Optional)</label>
              <input type="text" value={hometown} onChange={(e) => setHometown(e.target.value)} placeholder="e.g., Johor Bahru" className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">IC No. (Optional)</label>
              <input type="text" value={icNo} onChange={(e) => setIcNo(e.target.value)} placeholder="e.g., 040512-01-1234" className="w-full rounded-xl border border-emerald-200 px-3 py-2 text-sm font-mono" />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm cursor-pointer disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save Profile</span>
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-3xl border border-emerald-200 overflow-hidden shadow-xs">
        <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-emerald-950">My Events Attended History</h3>
              <p className="text-xs text-slate-500">Tracks every club activity you joined, along with QR check-in, transport, and fee status.</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-emerald-700 text-white">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>Attended: {attendedCount}</span>
          </span>
        </div>

        {myRsvps.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-500">No activity attendance records yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50 text-[11px] font-bold uppercase text-emerald-900 border-b border-emerald-100">
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4">Date &amp; Venue</th>
                  <th className="py-3 px-4">Attendance &amp; QR</th>
                  <th className="py-3 px-4">Transport</th>
                  <th className="py-3 px-4">Fee Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {myRsvps.map((r) => {
                  const ev = budgets.find((b) => b.id === r.budget_id);
                  const myFee = myFeePayments.find((f) => f.budget_id === r.budget_id);
                  return (
                    <tr key={r.id} className="hover:bg-emerald-50/40">
                      <td className="py-3 px-4 font-bold text-slate-900">{ev?.event_name || 'Activity'}</td>
                      <td className="py-3 px-4">{ev?.event_date || '-'} • {ev?.location || '-'}</td>
                      <td className="py-3 px-4 space-x-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${r.attendance === 'Attending' ? 'bg-emerald-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                          {r.attendance}
                        </span>
                        {r.qr_checked_in && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                            <QrCode className="w-3 h-3" />
                            <span>QR Verified</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.is_driver ? (
                          <span className="font-bold text-amber-800"><Car className="w-3.5 h-3.5 inline mr-1" />Driver ({r.trips_count} trip)</span>
                        ) : (
                          <span>{r.transport_type === 'None' ? 'Own Transport' : r.transport_type} {r.assigned_driver_name ? `(Driver: ${r.assigned_driver_name})` : ''}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {myFee ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px]">Paid RM {Number(myFee.amount_paid).toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}