import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'your-project-url.supabase.co' &&
    supabaseUrl.startsWith('http')
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key'
);

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '50 MB';

export const DEFAULT_DEPARTMENTS: string[] = [
  'Executive Committee (EXCO)',
  'President / Vice President',
  'Secretary',
  'Treasurer / Finance',
  'Logistics & Equipment Unit',
  'Multimedia & Publicity Unit',
  'Program & Event Unit',
  'Sponsorship & External Relations',
  'Welfare & Safety Unit',
  'Committee Member (AJK)',
  'Ordinary Member',
];

export type ExpenseCategory = string;

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
  can_manage_activities: true,
  can_manage_posters_polls: true,
  can_manage_equipment: true,
  can_manage_claims_fees: false,
  can_manage_transport: true,
  can_manage_finance: false,
  can_manage_members: false,
};

export const FULL_OWNER_PERMISSIONS: AdminPermissions = {
  can_manage_activities: true,
  can_manage_posters_polls: true,
  can_manage_equipment: true,
  can_manage_claims_fees: true,
  can_manage_transport: true,
  can_manage_finance: true,
  can_manage_members: true,
};

export const PERMISSION_LABELS: {
  key: keyof AdminPermissions;
  label: string;
  desc: string;
}[] = [
  { key: 'can_manage_activities', label: '1. Activities & QR Attendance', desc: 'Create/edit activities and manage QR check-ins' },
  { key: 'can_manage_posters_polls', label: '2. Posters, Announcements & Polls', desc: 'Publish posters, notices, and polls' },
  { key: 'can_manage_equipment', label: '3. Equipment Inventory & Loans', desc: 'Add equipment and mark items returned' },
  { key: 'can_manage_claims_fees', label: '4. Approve Claims & Verify Fees', desc: 'Approve/reject claims and verify fee receipts' },
  { key: 'can_manage_transport', label: '5. Carpool & Driver Assignment', desc: 'Assign passengers to drivers and manage trips' },
  { key: 'can_manage_finance', label: '6. Edit Club Finance & Savings', desc: 'Add/edit/delete Money In & Out (Otherwise View-Only)' },
  { key: 'can_manage_members', label: '7. Manage Members & Departments', desc: 'Customize departments and remove regular members' },
];

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  matric_no: string;
  phone_number: string;
  role: 'member' | 'treasurer' | 'owner';
  admin_permissions?: AdminPermissions;
  member_type?: string;
  year_of_study?: string;
  course?: string;
  hometown?: string;
  ic_no?: string;
  dormitory?: string;
  member_status?: string;
  batch_year?: string;
  bank_name?: string;
  bank_account_no?: string;
  bank_account_holder?: string;
  bank_qr_url?: string;
  allow_whatsapp_chat?: boolean;
  created_at: string;
}

export interface ChatDirectoryMember {
  id: string;
  full_name: string;
  matric_no: string;
  role: 'member' | 'treasurer' | 'owner';
  member_type: string;
  batch_year: string;
  member_status?: string;
  allow_whatsapp_chat?: boolean;
}

export interface ChatMessageItem {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export type TicketQrMode = 'scan_attendance' | 'entry_pass' | 'all_registered' | 'paid_only' | 'manual_only';
export type PassApprovalRule = 'auto_after_payment' | 'manual_only';

export function isEntryPassMode(mode?: string): boolean {
  return mode === 'entry_pass' || mode === 'paid_only' || mode === 'manual_only';
}

export interface Budget {
  id: string;
  event_name: string;
  category: string;
  event_date: string;
  event_time: string;
  location: string;
  allocated_amount: number;
  spent_amount: number;
  registration_fee: number;
  driver_allowance_per_trip: number;
  driver_recruitment_open: boolean;
  qr_code_token?: string;
  ticket_qr_mode?: TicketQrMode;
  pass_approval_rule?: PassApprovalRule;
  payment_qr_url?: string;
  payment_bank_info?: string;
  show_payment_qr?: boolean;
  description: string;
  status: 'Active' | 'Closed';
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface BudgetPlanItem {
  id: string;
  budget_id: string;
  entry_type: 'IN' | 'OUT';
  item: string;
  category: string;
  planned_amount: number;
  notes?: string;
  created_by?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface EventRsvp {
  id: string;
  budget_id: string;
  user_id: string;
  student_name: string;
  matric_no: string;
  phone_number: string;
  member_type: string;
  dormitory: string;
  attendance: 'Attending' | 'Not Attending';
  transport_type: 'None' | 'One-Way' | 'Return Trip' | 'Round Trip';
  is_driver: boolean;
  car_details: string;
  seats_available: number;
  trips_count: number;
  assigned_driver_name: string;
  pickup_time?: string | null;
  pickup_point?: string | null;
  qr_checked_in?: boolean;
  qr_checked_in_at?: string | null;
  pass_approved?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  updated_at: string;
}

export type AccountType = 'Bank' | 'Cash';

export interface ActivityFeePayment {
  id: string;
  budget_id: string;
  user_id: string;
  student_name: string;
  matric_no: string;
  phone_number: string;
  amount_paid: number;
  account_type?: AccountType;
  receipt_url: string;
  receipt_file_name: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface Claim {
  id: string;
  user_id: string;
  claimant_name: string;
  matric_no: string;
  phone_number: string;
  budget_id: string | null;
  custom_event_name?: string;
  title: string;
  category: string;
  amount: number;
  account_type?: AccountType;
  expense_date: string;
  merchant_name: string;
  description: string;
  payment_info?: string;
  claimant_qr_url?: string;
  payout_proof_url?: string;
  payout_proof_name?: string;
  show_payout_proof?: boolean;
  paid_at?: string;
  receipt_url: string;
  receipt_file_name: string;
  ai_extracted_amount: number | null;
  ai_extracted_merchant: string | null;
  ai_extracted_date: string | null;
  ai_confidence: number | null;
  ai_ocr_summary?: string | null;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewed_by: string | null;
  review_remarks: string | null;
  reviewed_at: string | null;
  treasurer_verified_by?: string | null;
  treasurer_verified_at?: string | null;
  final_approved_by?: string | null;
  final_approved_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export const DEFAULT_CLAIM_APPROVAL_THRESHOLD = 200;

export interface EquipmentItem {
  id: string;
  item_name: string;
  category: string;
  total_quantity: number;
  available_quantity: number;
  location: string;
  notes: string;
  requires_approval?: boolean;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface EquipmentLoan {
  id: string;
  item_id: string;
  item_name: string;
  user_id: string;
  borrower_name: string;
  matric_no: string;
  phone_number: string;
  quantity: number;
  purpose: string;
  borrow_date: string;
  return_date: string;
  status: 'Borrowed' | 'Returned' | 'Overdue';
  returned_at: string | null;
  approval_status?: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | null;
  approved_by?: string | null;
  approved_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_matric: string | null;
  actor_role: string | null;
  action: string;
  category: string;
  details: string;
  created_at: string;
}

export type ActivityLogCategory =
  | 'Finance'
  | 'Claims'
  | 'Fees'
  | 'Equipment'
  | 'Activities'
  | 'Members'
  | 'Carpool'
  | 'Attendance'
  | 'Settings';

interface LogActor {
  id: string;
  full_name: string;
  matric_no?: string;
  role?: string;
}

/**
 * Append-only audit trail. Fire-and-forget: a logging failure (e.g. table not
 * created yet) must never block the user's real action.
 */
export async function logActivity(
  actor: LogActor | null | undefined,
  category: ActivityLogCategory,
  action: string,
  details: string
): Promise<void> {
  if (!actor) return;
  try {
    const roleLabel = actor.role === 'owner' ? 'Owner' : actor.role === 'treasurer' ? 'Admin' : 'Member';
    await supabase.from('activity_logs').insert({
      actor_id: actor.id,
      actor_name: actor.full_name,
      actor_matric: actor.matric_no || null,
      actor_role: roleLabel,
      category,
      action,
      details,
    });
  } catch {
    /* never block the UI */
  }
}

export interface Announcement {
  id: string;
  title: string;
  subtitle: string;
  content: string;
  poster_url: string;
  external_link: string;
  link_label: string;
  is_pinned: boolean;
  show_in_carousel: boolean;
  created_by: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface Poll {
  id: string;
  question: string;
  options: string[];
  is_active: boolean;
  show_results?: boolean;
  created_by: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

export interface PollVote {
  id: string;
  poll_id: string;
  user_id: string;
  voter_name: string;
  option_index: number;
  created_at: string;
}

export const TRANSPORT_OPTIONS: ('None' | 'One-Way' | 'Return Trip' | 'Round Trip')[] = [
  'None',
  'One-Way',
  'Return Trip',
  'Round Trip',
];

export async function downloadFileFromUrl(url: string, fallbackName: string) {
  if (!url) return;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const ext = url.split('?')[0].split('.').pop() || 'png';
    const finalName = fallbackName.includes('.') ? fallbackName : `${fallbackName}.${ext}`;
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export type ExcelCellValue =
  | string
  | number
  | null
  | undefined
  | { f: string; t?: 'n' | 's'; z?: string; v?: number | string };

export interface ExcelSheetInput {
  name: string;
  headers: string[];
  rows: ExcelCellValue[][];
}

declare global {
  interface Window {
    XLSX?: {
      read: (data: ArrayBuffer, opts?: { type?: string }) => {
        SheetNames: string[];
        Sheets: Record<string, unknown>;
      };
      utils: {
        book_new: () => unknown;
        aoa_to_sheet: (data: unknown[][]) => Record<string, unknown>;
        book_append_sheet: (wb: unknown, ws: unknown, name: string) => void;
        sheet_to_json: <T = Record<string, unknown>>(
          ws: unknown,
          opts?: { header?: number; defval?: unknown; raw?: boolean }
        ) => T[];
      };
      writeFile: (wb: unknown, filename: string) => void;
    };
  }
}

export async function ensureSheetJsLoaded(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.XLSX) return true;
  await new Promise<void>((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
  return Boolean(window.XLSX);
}

function escapeXml(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportMultiSheetExcel(filenameBase: string, sheets: ExcelSheetInput[]) {
  if (typeof window === 'undefined') return;
  const safeBase = filenameBase.replace(/[^a-zA-Z0-9_-]/g, '_');

  await ensureSheetJsLoaded();

  if (window.XLSX) {
    const wb = window.XLSX.utils.book_new();
    sheets.forEach((sheet, idx) => {
      const cleanName = (sheet.name || `Sheet${idx + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31);
      const aoa: unknown[][] = [
        sheet.headers,
        ...sheet.rows.map((r) =>
          r.map((c) => {
            if (c === null || c === undefined) return '';
            if (typeof c === 'object' && 'f' in c) {
              return { f: c.f, t: c.t || 'n', ...(c.z ? { z: c.z } : {}), ...(c.v !== undefined ? { v: c.v } : {}) };
            }
            return c;
          })
        ),
      ];
      const ws = window.XLSX!.utils.aoa_to_sheet(aoa);
      ws['!cols'] = sheet.headers.map((h) => ({ wch: Math.max(16, h.length + 5) }));
      window.XLSX!.utils.book_append_sheet(wb, ws, cleanName);
    });
    window.XLSX.writeFile(wb, `${safeBase}.xlsx`);
    return;
  }

  const worksheetsXml = sheets
    .map((sheet, idx) => {
      const cleanName = escapeXml((sheet.name || `Sheet${idx + 1}`).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
      const headerRow = `<Row>${sheet.headers
        .map((h) => `<Cell ss:StyleID="sHeader"><Data ss:Type="String">${escapeXml(String(h))}</Data></Cell>`)
        .join('')}</Row>`;
      const dataRows = sheet.rows
        .map(
          (row) =>
            `<Row>${row
              .map((cell) => {
                const rawVal = cell && typeof cell === 'object' && 'v' in cell ? cell.v : cell;
                const isNum = typeof rawVal === 'number' && !isNaN(rawVal);
                return `<Cell><Data ss:Type="${isNum ? 'Number' : 'String'}">${escapeXml(
                  String(rawVal ?? '')
                )}</Data></Cell>`;
              })
              .join('')}</Row>`
        )
        .join('');
      return `<Worksheet ss:Name="${cleanName}"><Table>${headerRow}${dataRows}</Table></Worksheet>`;
    })
    .join('');

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="sHeader">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#047857" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;

  const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${safeBase}.xls`;
  a.click();
}