// Hand-written types matching our SQL schema.
// Run `supabase gen types typescript` to regenerate automatically after schema changes.

export type UserRole = "worker" | "manager" | "owner";
export type TreeStatus = "active" | "retired" | "dead";
export type SetStatus = "flowering" | "developing" | "harvesting" | "harvested" | "failed";
export type GenerationColor = "red" | "blue" | "yellow" | "white";
export type WorkerTrustTier = "trusted" | "standard" | "audit";
export type WorkerLanguage = "my" | "th" | "en";
export type PhotoPolicyMode = "always" | "audit_only" | "never";
export type PhotoRequirementReason = "task_default" | "random_audit" | "alert_followup" | "none";
export type AssignmentStatus = "pending" | "in_progress" | "completed" | "overdue" | "skipped";
export type AssignmentPriority = "low" | "normal" | "high" | "urgent";
export type AssignmentSource = "recurring" | "alert_triggered" | "manual";
export type AlertTier = "tier_1" | "tier_2" | "tier_3";
export type AlertCategory = "farm_health" | "fraud_signal" | "inactivity" | "compliance";
export type AlertStatus = "open" | "reviewed" | "resolved" | "dismissed";
export type ValidationStatus = "passed" | "flagged" | "rejected";
export type Severity = "none" | "mild" | "moderate" | "severe";

export interface I18nString {
  th: string;
  my: string;
  en: string;
  icon?: string;
}

export interface TaskFieldOption {
  value: string;
  icon: string;
  label: I18nString;
}

export interface TaskField {
  field_id: string;
  type: "numeric_counter" | "dropdown" | "color_picker" | "severity_picker" | "slider";
  label_icon: string;
  label: I18nString;
  required: boolean;
  min?: number;
  max?: number;
  default_value?: number;
  warn_below?: number;
  warn_above?: number;
  step?: number;
  options?: TaskFieldOption[];
}

export interface PhotoPolicy {
  mode: PhotoPolicyMode;
  audit_rate_by_tier?: { trusted: number; standard: number; audit: number };
}

export interface DerivedState {
  last_updated: string | null;
  active_set_ids: string[];
  last_maintenance: { type: string; date: string; task_log_id: string } | null;
  health_score: number;
  open_alerts: number;
  days_since_last_log: number | null;
}

// DB row shapes

export interface DbUser {
  id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorker {
  worker_id: string;
  language: WorkerLanguage;
  assigned_zones: string[];
  active: boolean;
  reliability_logs_total: number;
  reliability_logs_flagged: number;
  reliability_flag_rate: number;
  reliability_avg_completion_seconds: number;
  trust_tier: WorkerTrustTier;
  trust_tier_set_by: string;
  trust_tier_changed_at: string;
  created_at: string;
  updated_at: string;
}

export interface DbWorkerWithUser extends DbWorker {
  users: DbUser;
}

export interface DbTree {
  tree_id: string;
  qr_code: string;
  lat: number;
  long: number;
  zone: string;
  side: "L" | "R";
  row_num: number;
  position: number;
  planted_date: string;
  variety: string;
  status: TreeStatus;
  retired_date: string | null;
  derived_last_updated: string | null;
  derived_active_set_ids: string[];
  derived_last_maintenance: { type: string; date: string; task_log_id: string } | null;
  derived_health_score: number;
  derived_open_alerts: number;
  derived_days_since_last_log: number | null;
  created_at: string;
  updated_at: string;
}

export interface DbTaskDefinition {
  task_def_id: string;
  task_type: string;
  display_name: I18nString;
  photo_policy_mode: PhotoPolicyMode;
  photo_policy_audit_rates: { trusted: number; standard: number; audit: number } | null;
  requires_qr_scan: boolean;
  min_completion_seconds: number;
  min_qr_to_submit_seconds: number;
  fields: TaskField[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DbTaskLog {
  log_id: string;
  tree_id: string;
  task_def_id: string;
  task_type: string;
  assignment_id: string | null;
  worker_id: string;
  submitted_at: string;
  form_opened_at: string;
  qr_scanned_at: string;
  qr_value: string;
  gps_lat: number | null;
  gps_long: number | null;
  gps_delta_meters: number | null;
  form_data: Record<string, unknown>;
  photo_required: boolean;
  photo_requirement_reason: PhotoRequirementReason;
  photo_audit_selection_seed: string | null;
  photo_url: string | null;
  validation_status: ValidationStatus;
  validation_flags: string[];
  notes_text: string | null;
  created_at: string;
}

export interface DbSet {
  set_id: string;
  tree_id: string;
  color: GenerationColor;
  season: string;
  bloom_log_id: string;
  bloom_date: string;
  estimated_maturation_days: number;
  harvest_window_start: string;
  harvest_window_end: string;
  initial_fruit_count: number;
  current_fruit_count: number;
  premium_fruit_count: number;
  status: SetStatus;
  harvest_log_ids: string[];
  harvested_at: string | null;
  history: Array<{ date: string; event: string; fruit_count: number; log_id: string }>;
  created_at: string;
  updated_at: string;
}

export interface DbAlert {
  alert_id: string;
  tier: AlertTier;
  category: AlertCategory;
  subtype: string;
  tree_id: string | null;
  worker_id: string | null;
  triggered_by_log_id: string | null;
  status: AlertStatus;
  resolution: { action_taken: string; resolved_by: string; resolved_at: string; notes: string } | null;
  suggested_response_task_def_id: string | null;
  created_at: string;
}

export interface DbAssignment {
  assignment_id: string;
  worker_id: string;
  tree_id: string;
  task_def_id: string;
  scheduled_for: string;
  priority: AssignmentPriority;
  source: AssignmentSource;
  triggered_by_alert_id: string | null;
  status: AssignmentStatus;
  completed_log_id: string | null;
  created_at: string;
  updated_at: string;
}
