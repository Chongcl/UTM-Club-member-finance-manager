import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const isSupabaseConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project-id');

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type UserRole = 'member' | 'treasurer' | 'owner';
export type TicketQrMode = 'scan_attendance' | 'entry_pass' | 'all_registered' | 'paid_only' | 'manual_only';
export type PassApprovalRule = 'auto_after_payment' | 'manual_only';

export interface AdminPermissions {
  can_manage_activities: boolean;
  can_manage_posters_polls: boolean;
  can_manage_equipment: boolean;
  can_manage_claims_fees: boolean;
  can_manage_transport: boolean;
  can_manage_finance: boolean;
  can_manage_members: boolean;
}

export const DEFAULT_ADMIN_PERMISSIONS: AdminPermissions = {
  can_manage_activities: false, can_manage_posters_polls: false, can_manage_equipment: false,
  can_manage_claims_fees: false, can_manage_transport: false, can_manage_finance: false, can_manage_members: false,
};

export const FULL_OWNER_PERMISSIONS: AdminPermissions = {
  can_manage_activities: true, can_manage_posters_polls: true, can_manage_equipment: true,
  can_manage_claims_fees: true, can_manage_transport: true, can_manage_finance: true, can_manage_members: true,
};

export const PERMISSION_LABELS: { key: keyof AdminPermissions; label: string; desc: string }[] = [
  { key: 'can_manage_activities', label: 'Manage Activities & QR Settings', desc: 'Create/edit activities, configure attendance mode, and manage QR passes.' },
  { key: 'can_manage_posters_polls', label: 'Customize Logo, Background, Posters & Polls', desc: 'Change club logo, background themes, posters, notices, and poll visibility.' },
  { key: 'can_manage_equipment', label: 'Manage Equipment Inventory & Loans', desc: 'Add/edit equipment items and manage member borrow records.' },
  { key: 'can_manage_claims_fees', label: 'Approve Claims & Verify Activity Fees', desc: 'Approve/reject reimbursement claims and verify student fee payments.' },
  { key: 'can_manage_transport', label: 'Manage Carpool & Assign Drivers', desc: 'Adjust driver allowances and assign passengers to drivers.' },
  { key: 'can_manage_finance', label: 'Manage Club Finance & Savings Ledger', desc: 'Add, edit, or delete income and expense ledger entries.' },
  { key: 'can_manage_members', label: 'Manage Members, Batch Clearance & Departments', desc: 'Promote Admins, run batch clearance, and customize department names.' },
];

export interface UserProfile {
  id: string; email: string; full_name: string; matric_no: string; phone_number: string;
  role: UserRole; admin_permissions: AdminPermissions; member_type: string; year_of_study: string;
  course: string; hometown: string; ic_no: string; dormitory: string; member_status: string;
  batch_year: string; created_at: string;
}

export interface Budget {
  id: string; event_name: string; category: string; event_date: string; event_time: string;
  location: string; allocated_amount: number; spent_amount: number; registration_fee: number;
  driver_allowance_per_trip: number; driver_recruitment_open: boolean; qr_code_token?: string;
  ticket_qr_mode?: TicketQrMode; description: string; status: 'Active' | 'Closed'; created_at: string;
}

export interface EventRsvp {
  id: string; budget_id: string; user_id: string; student_name: string; matric_no: string;
  phone_number: string; member_type: string; dormitory: string;
  attendance: 'Attending' | 'Not Attending';
  transport_type: 'None' | 'One-Way' | 'Return Trip' | 'Round Trip';
  is_driver: boolean; car_details: string; seats_available: number; trips_count: number;
  assigned_driver_name: string; qr_checked_in?: boolean; qr_checked_in_at?: string | null;
  pass_approved?: boolean; updated_at: string;
}

export interface ActivityFeePayment {
  id: string; budget_id: string; user_id: string; student_name: string; matric_no: string;
  phone_number: string; amount_paid: number; receipt_url: string; receipt_file_name: string;
  status: 'Pending' | 'Verified' | 'Rejected'; admin_remarks: string; created_at: string;
}

export interface Claim {
  id: string; budget_id: string | null; custom_event_name?: string; user_id: string;
  claimant_name: string; matric_no: string; phone_number: string; title: string;
  merchant_name: string; expense_date: string; amount: number; category: string;
  description: string; receipt_url: string; receipt_file_name: string; ai_ocr_summary: string;
  status: 'Pending' | 'Approved' | 'Rejected'; treasurer_remarks: string; reviewed_by: string;
  reviewed_at: string | null; created_at: string;
}

export interface EquipmentItem { id: string; item_name: string; total_quantity: number; remarks: string; created_at: string; }
export interface EquipmentLoan {
  id: string; equipment_id: string; equipment_name: string; user_id: string; borrower_name: string;
  matric_no: string; phone_number: string; quantity: number; application_date: string;
  borrow_date: string; return_date: string; status: 'Pending' | 'Borrowed' | 'Returned' | 'Overdue';
  remarks: string; created_at: string;
}
export interface Announcement {
  id: string; title: string; subtitle: string; content: string; poster_url: string;
  external_link: string; link_label: string; is_pinned: boolean; show_in_carousel: boolean;
  created_by: string; created_at: string;
}
export interface Poll {
  id: string; question: string; options: string[]; is_active: boolean;
  show_results?: boolean; created_by: string; created_at: string;
}
export interface PollVote { id: string; poll_id: string; user_id: string; voter_name: string; option_index: number; created_at: string; }

export const DEFAULT_DEPARTMENTS = ['Member', 'Logistics & Equipment Unit', 'Event & Tournament Unit', 'Multimedia & Publicity Unit', 'Training & Development Unit', 'Other'];
export const CLUB_DEPARTMENTS = DEFAULT_DEPARTMENTS;
export const EXPENSE_CATEGORIES = DEFAULT_DEPARTMENTS;
export const TRANSPORT_OPTIONS = ['None', 'One-Way', 'Return Trip', 'Round Trip'] as const;
export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

export function isEntryPassMode(mode?: string): boolean {
  return mode === 'entry_pass' || mode === 'paid_only' || mode === 'manual_only';
}