// Hand-written types matching our SQL schema.
// Run `supabase gen types typescript` to regenerate automatically after schema changes.

export type UserRole = "worker" | "manager" | "owner";
export type TreeStatus = "active" | "retired" | "dead";
/** Why a set closed. All but "failed" are derived by sync_set() (014_functions.sql). */
export type SetCloseReason = "harvested_out" | "final_pick" | "all_dropped" | "failed" | "bloom_voided";
/** Lifecycle stage, derived by the set_state view — never stored. */
export type SetStage = "flowering" | "developing" | "harvesting" | "closed";
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
export type CorrectionType = "correction" | "void";

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

export type TaskFieldType =
  | "numeric_counter"
  | "slider"
  | "dropdown"
  | "color_picker"
  | "severity_picker"
  | "grade_counter"
  /** Picks one of the tree's open sets; value is the set_id (harvest, fruit check). */
  | "set_picker"
  /** Yes/no; value is a boolean. */
  | "toggle";

/** task_definitions.task_type values the code branches on. */
export type TaskType =
  | "fertilizer"
  | "watering"
  | "bloom_log"
  | "pest_inspection"
  | "soil_check"
  | "fruit_check"
  | "harvest";

export interface TaskField {
  field_id: string;
  type: TaskFieldType;
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
  /** Optional helper text shown under the field. */
  hint?: I18nString;
  /**
   * A required field stops being required while this (toggle) field is true — e.g. the
   * harvest's grade counts aren't needed for a "last pick" that found no fruit.
   */
  required_unless?: string;
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
  /** NUMERIC columns arrive from PostgREST as strings — parse with Number(). */
  lat: number | string;
  long: number | string;
  zone: string;
  side: "L" | "R";
  row_num: number;
  position: number;
  planted_date: string;
  variety: string;
  status: TreeStatus;
  retired_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbTaskDefinition {
  task_def_id: string;
  task_type: string;
  display_name_th: string;
  display_name_my: string;
  display_name_en: string;
  icon: string | null;
  photo_policy_mode: PhotoPolicyMode;
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
  // NULL on an original submission. Set on a row that amends an earlier one — see
  // 012_task_log_corrections.sql. correction_of_log_id always points at the root
  // log, never at another correction/void.
  correction_of_log_id: string | null;
  correction_type: CorrectionType | null;
  correction_reason: string | null;
  /** The set a fruit check / harvest was logged against (bloom logs: NULL — see sets.bloom_log_id). */
  set_id: string | null;
}

export interface DbSet {
  set_id: string;
  tree_id: string;
  color: GenerationColor;
  bloom_log_id: string;
  bloom_date: string;
  estimated_maturation_days: number;
  harvest_window_start: string;
  harvest_window_end: string;
  closed_at: string | null;
  close_reason: SetCloseReason | null;
  created_at: string;
  updated_at: string;
}

// --- Views (013_views.sql) — derived on read, never stored ---

/** One row per live record: latest correction applied, voided records removed. */
export interface EffectiveTaskLog {
  log_id: string;
  tree_id: string;
  zone: string;
  side: "L" | "R";
  task_def_id: string;
  task_type: string;
  set_id: string | null;
  worker_id: string;
  worker_name: string | null;
  submitted_at: string;
  form_opened_at: string;
  qr_scanned_at: string;
  qr_value: string;
  gps_lat: number | string | null;
  gps_long: number | string | null;
  gps_delta_meters: number | string | null;
  form_data: Record<string, unknown>;
  validation_status: ValidationStatus;
  validation_flags: string[];
  photo_required: boolean;
  photo_url: string | null;
  notes_text: string | null;
  latest_correction_id: string | null;
  corrected_at: string | null;
}

export interface SetState extends DbSet {
  bloom_flowers: number | null;
  latest_fruit_count: number | null;
  last_checked_at: string | null;
  harvested_total: number;
  harvested_since_check: number;
  harvest_count: number;
  final_pick: boolean;
  last_harvest_at: string | null;
  remaining: number;
  lost: number | null;
  stage: SetStage;
}

export interface WorkerStats {
  worker_id: string;
  logs_total: number;
  logs_flagged: number;
  avg_completion_seconds: number;
  recent_logs_total: number;
  recent_logs_flagged: number;
  recent_avg_completion_seconds: number;
  last_log_at: string | null;
}

export interface TreeSummary {
  tree_id: string;
  zone: string;
  side: "L" | "R";
  status: TreeStatus;
  last_log_at: string | null;
  open_alerts: number;
  has_tier1_alert: boolean;
  open_sets: number;
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
  resolution_action_taken: string | null;
  resolution_resolved_by: string | null;
  resolution_resolved_at: string | null;
  resolution_notes: string | null;
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

/**
 * Write RPCs return either a success payload or `{ error: <code>, ...details }` — never
 * raise — so API routes can map the code to a translated message.
 */
export type RpcResult = { error?: string; [key: string]: unknown };

// Supabase client generic, hand-built from the Row interfaces above rather than
// `supabase gen types typescript` (that needs Docker running locally — see the
// comment at the top of this file). Insert/Update are intentionally loose
// (Partial<Row>) rather than precisely matching DB defaults/nullability; regenerate
// this properly with the Supabase CLI once Docker is available.
//
// Flatten forces `interface` types into plain object types — without it, postgrest-js's
// conditional query-result types fail to pattern-match against named interfaces and
// silently resolve every query result to `never`.
type Flatten<T> = { [K in keyof T]: T[K] };
type Table<Row> = {
  Row: Flatten<Row>;
  Insert: Flatten<Partial<Row>>;
  Update: Flatten<Partial<Row>>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      users: Table<DbUser>;
      workers: Table<DbWorker>;
      trees: Table<DbTree>;
      task_definitions: Table<DbTaskDefinition>;
      task_logs: Table<DbTaskLog>;
      sets: Table<DbSet>;
      alerts: Table<DbAlert>;
      assignments: Table<DbAssignment>;
    };
    Views: {
      effective_task_logs: { Row: Flatten<EffectiveTaskLog>; Relationships: [] };
      set_state: { Row: Flatten<SetState>; Relationships: [] };
      worker_stats: { Row: Flatten<WorkerStats>; Relationships: [] };
      tree_summary: { Row: Flatten<TreeSummary>; Relationships: [] };
    };
    Functions: {
      submit_task_log: { Args: { p: Record<string, unknown> }; Returns: RpcResult };
      correct_task_log: {
        Args: {
          p_log_id: string; p_worker: string; p_form: Record<string, unknown>;
          p_status: ValidationStatus; p_flags: string[]; p_reason: string;
        };
        Returns: RpcResult;
      };
      void_task_log: { Args: { p_log_id: string; p_worker: string; p_reason: string }; Returns: RpcResult };
      dashboard_snapshot: { Args: { p_stale_days: number }; Returns: unknown };
      manager_set_failed: { Args: { p_set: string; p_failed: boolean }; Returns: RpcResult };
      fruit_by_grade: {
        Args: { p_since?: string | null; p_zone?: string | null; p_side?: string | null; p_worker?: string | null; p_status?: ValidationStatus | null };
        Returns: Record<string, number>;
      };
    };
  };
}
