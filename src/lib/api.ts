import funcUrls from "../../backend/func2url.json";

const API_URL = funcUrls.api;

type Params = Record<string, string | number | undefined>;

function getStaffToken(): string {
  return localStorage.getItem("staff_token") || "";
}

async function request<T>(method: string, params?: Params, body?: unknown): Promise<T> {
  const url = new URL(API_URL);
  if (params) {
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined) url.searchParams.set(key, String(val));
    });
  }

  const hdrs: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStaffToken();
  if (token) hdrs["X-Auth-Token"] = token;

  const options: RequestInit = { method, headers: hdrs };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(url.toString(), options);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Ошибка сервера");
  return data;
}

export const api = {
  dashboard: () => request<DashboardStats>("GET", { entity: "dashboard" }),

  members: {
    list: () => request<Member[]>("GET", { entity: "members" }),
    get: (id: number) => request<MemberDetail>("GET", { entity: "members", id }),
    create: (data: Partial<MemberDetail>) => request<{ id: number; member_no: string }>("POST", undefined, { entity: "members", ...data }),
    update: (data: Partial<MemberDetail>) => request<{ success: boolean }>("PUT", { entity: "members" }, { entity: "members", ...data }),
  },

  loans: {
    list: () => request<Loan[]>("GET", { entity: "loans" }),
    get: (id: number) => request<LoanDetail>("GET", { entity: "loans", action: "detail", id }),
    calcSchedule: (amount: number, rate: number, term: number, scheduleType: string, startDate: string) =>
      request<{ schedule: ScheduleItem[]; monthly_payment: number }>("GET", {
        entity: "loans", action: "schedule", amount, rate, term, schedule_type: scheduleType, start_date: startDate,
      }),
    create: (data: CreateLoanData) => request<{ id: number; schedule: ScheduleItem[]; monthly_payment: number }>("POST", undefined, { entity: "loans", action: "create", ...data }),
    payment: (data: { loan_id: number; payment_date: string; amount: number }) =>
      request<PaymentResult>("POST", undefined, { entity: "loans", action: "payment", ...data }),
    earlyRepayment: (data: { loan_id: number; amount: number; repayment_type: string; payment_date: string }) =>
      request<unknown>("POST", undefined, { entity: "loans", action: "early_repayment", ...data }),
    modify: (data: { loan_id: number; new_rate?: number; new_term?: number }) =>
      request<unknown>("POST", undefined, { entity: "loans", action: "modify", ...data }),
    updatePayment: (data: { payment_id: number; payment_date?: string; amount?: number; principal_part?: number; interest_part?: number; penalty_part?: number }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "loans", action: "update_payment", ...data }),
    deletePayment: (paymentId: number) =>
      request<{ success: boolean }>("POST", undefined, { entity: "loans", action: "delete_payment", payment_id: paymentId }),
  },

  savings: {
    list: () => request<Saving[]>("GET", { entity: "savings" }),
    get: (id: number) => request<SavingDetail>("GET", { entity: "savings", action: "detail", id }),
    calcSchedule: (amount: number, rate: number, term: number, payoutType: string, startDate: string) =>
      request<{ schedule: SavingsScheduleItem[] }>("GET", {
        entity: "savings", action: "schedule", amount, rate, term, payout_type: payoutType, start_date: startDate,
      }),
    create: (data: CreateSavingData) => request<{ id: number; schedule: SavingsScheduleItem[] }>("POST", undefined, { entity: "savings", action: "create", ...data }),
    transaction: (data: { saving_id: number; amount: number; transaction_type: string; transaction_date?: string; is_cash?: boolean; description?: string }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "savings", action: "transaction", ...data }),
    earlyClose: (savingId: number) => request<{ final_amount: number; early_interest: number }>("POST", undefined, { entity: "savings", action: "early_close", saving_id: savingId }),
    interestPayout: (data: { saving_id: number; amount?: number; transaction_date?: string }) =>
      request<{ success: boolean; amount: number }>("POST", undefined, { entity: "savings", action: "interest_payout", ...data }),
    updateTransaction: (data: { transaction_id: number; amount?: number; transaction_date?: string; description?: string }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "savings", action: "update_transaction", ...data }),
    deleteTransaction: (transactionId: number) =>
      request<{ success: boolean }>("POST", undefined, { entity: "savings", action: "delete_transaction", transaction_id: transactionId }),
  },

  shares: {
    list: () => request<ShareAccount[]>("GET", { entity: "shares" }),
    get: (id: number) => request<ShareAccountDetail>("GET", { entity: "shares", action: "detail", id }),
    create: (data: { member_id: number; amount: number }) => request<{ id: number; account_no: string }>("POST", undefined, { entity: "shares", action: "create", ...data }),
    transaction: (data: { account_id: number; amount: number; transaction_type: string; transaction_date?: string; description?: string }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "shares", action: "transaction", ...data }),
    updateTransaction: (data: { transaction_id: number; amount?: number; transaction_date?: string; description?: string }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "shares", action: "update_transaction", ...data }),
    deleteTransaction: (transactionId: number) =>
      request<{ success: boolean }>("POST", undefined, { entity: "shares", action: "delete_transaction", transaction_id: transactionId }),
  },

  export: {
    download: async (type: "loan" | "saving" | "share", id: number, format: "xlsx" | "pdf") => {
      const res = await request<ExportResult>("GET", { entity: "export", type, id, format });
      const binary = atob(res.file);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.content_type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  },

  auth: {
    sendSms: (phone: string) => request<AuthSmsResult>("POST", undefined, { entity: "auth", action: "send_sms", phone }),
    verifySms: (phone: string, code: string) => request<AuthVerifyResult>("POST", undefined, { entity: "auth", action: "verify_sms", phone, code }),
    setPassword: (setupToken: string, password: string) => request<AuthLoginResult>("POST", undefined, { entity: "auth", action: "set_password", setup_token: setupToken, password }),
    loginPassword: (phone: string, password: string) => request<AuthLoginResult>("POST", undefined, { entity: "auth", action: "login_password", phone, password }),
    changePassword: (token: string, oldPassword: string, newPassword: string) => request<{ success: boolean }>("POST", undefined, { entity: "auth", action: "change_password", token, old_password: oldPassword, new_password: newPassword }),
    logout: (token: string) => request<{ success: boolean }>("POST", undefined, { entity: "auth", action: "logout", token }),
    check: (token: string) => request<AuthLoginResult>("POST", undefined, { entity: "auth", action: "check", token }),
  },

  cabinet: {
    overview: (token: string) => request<CabinetOverview>("GET", { entity: "cabinet", action: "overview", token }),
    loanDetail: (token: string, id: number) => request<LoanDetail>("GET", { entity: "cabinet", action: "loan_detail", token, id }),
    savingDetail: (token: string, id: number) => request<CabinetSavingDetail>("GET", { entity: "cabinet", action: "saving_detail", token, id }),
  },

  staffAuth: {
    login: (login: string, password: string) => request<StaffLoginResult>("POST", undefined, { entity: "staff_auth", action: "login", login, password }),
    check: (token: string) => request<StaffLoginResult>("POST", undefined, { entity: "staff_auth", action: "check", token }),
    logout: (token: string) => request<{ success: boolean }>("POST", undefined, { entity: "staff_auth", action: "logout", token }),
    changePassword: (token: string, oldPassword: string, newPassword: string) => request<{ success: boolean }>("POST", undefined, { entity: "staff_auth", action: "change_password", token, old_password: oldPassword, new_password: newPassword }),
  },

  users: {
    list: () => request<StaffUser[]>("GET", { entity: "users" }),
    get: (id: number) => request<StaffUser>("GET", { entity: "users", id }),
    create: (data: { login: string; name: string; role: string; password: string; email?: string; phone?: string }) =>
      request<{ id: number; login: string }>("POST", undefined, { entity: "users", action: "create", ...data }),
    update: (data: { id: number; name?: string; role?: string; login?: string; email?: string; phone?: string; password?: string; status?: string }) =>
      request<{ success: boolean }>("POST", undefined, { entity: "users", action: "update", ...data }),
    delete: (id: number) => request<{ success: boolean }>("POST", undefined, { entity: "users", action: "delete", id }),
  },

  audit: {
    list: (params?: { limit?: number; offset?: number; filter_entity?: string; filter_action?: string }) =>
      request<AuditListResult>("GET", { entity: "audit", ...params }),
  },
};

export interface DashboardStats {
  total_members: number;
  active_loans: number;
  loan_portfolio: number;
  overdue_loans: number;
  total_savings: number;
  total_shares: number;
}

export interface Member {
  id: number;
  member_no: string;
  member_type: string;
  name: string;
  inn: string;
  phone: string;
  email: string;
  status: string;
  created_at: string;
  active_loans: number;
  active_savings: number;
}

export interface MemberDetail {
  id: number;
  member_no: string;
  member_type: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  birth_date: string;
  birth_place: string;
  inn: string;
  passport_series: string;
  passport_number: string;
  passport_dept_code: string;
  passport_issue_date: string;
  passport_issued_by: string;
  registration_address: string;
  phone: string;
  email: string;
  telegram: string;
  bank_bik: string;
  bank_account: string;
  marital_status: string;
  spouse_fio: string;
  spouse_phone: string;
  extra_phone: string;
  extra_contact_fio: string;
  company_name: string;
  director_fio: string;
  director_phone: string;
  contact_person_fio: string;
  contact_person_phone: string;
  status: string;
}

export interface Loan {
  id: number;
  contract_no: string;
  member_name: string;
  member_id: number;
  amount: number;
  rate: number;
  term_months: number;
  schedule_type: string;
  start_date: string;
  end_date: string;
  monthly_payment: number;
  balance: number;
  status: string;
}

export interface ScheduleItem {
  payment_no: number;
  payment_date: string;
  payment_amount: number;
  principal_amount: number;
  interest_amount: number;
  balance_after: number;
  status?: string;
  paid_amount?: number;
  penalty_amount?: number;
}

export interface LoanDetail extends Loan {
  schedule: ScheduleItem[];
  payments: LoanPayment[];
}

export interface LoanPayment {
  id: number;
  payment_date: string;
  amount: number;
  principal_part: number;
  interest_part: number;
  penalty_part: number;
  payment_type: string;
}

export interface CreateLoanData {
  contract_no: string;
  member_id: number;
  amount: number;
  rate: number;
  term_months: number;
  schedule_type: string;
  start_date: string;
}

export interface PaymentResult {
  success: boolean;
  new_balance: number;
  principal_part: number;
  interest_part: number;
  penalty_part: number;
  schedule_recalculated?: boolean;
  new_monthly?: number;
}

export interface Saving {
  id: number;
  contract_no: string;
  member_name: string;
  member_id: number;
  amount: number;
  rate: number;
  term_months: number;
  payout_type: string;
  start_date: string;
  end_date: string;
  accrued_interest: number;
  paid_interest: number;
  current_balance: number;
  status: string;
}

export interface SavingsScheduleItem {
  period_no: number;
  period_start: string;
  period_end: string;
  interest_amount: number;
  cumulative_interest: number;
  balance_after: number;
  status?: string;
}

export interface SavingDetail extends Saving {
  schedule: SavingsScheduleItem[];
  transactions: SavingTransaction[];
}

export interface SavingTransaction {
  id: number;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  is_cash: boolean;
  description: string;
}

export interface CreateSavingData {
  contract_no: string;
  member_id: number;
  amount: number;
  rate: number;
  term_months: number;
  payout_type: string;
  start_date: string;
}

export interface ShareAccount {
  id: number;
  account_no: string;
  member_name: string;
  member_id: number;
  balance: number;
  total_in: number;
  total_out: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ShareAccountDetail extends ShareAccount {
  transactions: ShareTransaction[];
}

export interface ShareTransaction {
  id: number;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  description: string;
}

export interface ExportResult {
  file: string;
  content_type: string;
  filename: string;
}

export interface AuthSmsResult {
  success: boolean;
  has_password: boolean;
  sms_sent: boolean;
  debug_code?: string;
  error?: string;
}

export interface AuthVerifyResult {
  success: boolean;
  has_password: boolean;
  authenticated?: boolean;
  token?: string;
  setup_token?: string;
  user?: { name: string; member_id: number };
  error?: string;
}

export interface AuthLoginResult {
  success: boolean;
  token?: string;
  user?: { name: string; member_id: number };
  error?: string;
}

export interface CabinetOverview {
  info: { name: string; member_no: string; phone: string; email: string };
  loans: Loan[];
  savings: Saving[];
  shares: ShareAccount[];
}

export interface CabinetSavingDetail extends Saving {
  schedule: SavingsScheduleItem[];
}

export interface StaffLoginResult {
  success: boolean;
  token?: string;
  user?: { name: string; role: string; login: string };
  error?: string;
}

export interface StaffUser {
  id: number;
  login: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  member_id: number | null;
  last_login: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user_name: string;
  user_role: string;
  action: string;
  entity: string;
  entity_id: number | null;
  entity_label: string;
  details: string;
  ip: string;
  created_at: string;
}

export interface AuditListResult {
  items: AuditLogEntry[];
  total: number;
}

export default api;