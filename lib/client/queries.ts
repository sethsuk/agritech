"use client";

/**
 * Query hooks + response types for every page — one place that knows the API shapes
 * and cache keys. Pages call these instead of hand-rolling fetch() in useEffect.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { api } from "./api";
import type {
  AlertCategory, AlertStatus, AlertTier, DbAlert, DbTaskDefinition, DbTree, SetState,
  TreeSummary, ValidationStatus, WorkerLanguage, WorkerTrustTier, EffectiveTaskLog,
} from "@/types/database";
import type { WorkerReliability } from "@/lib/derived/reliability";

export const qk = {
  taskDefs: ["taskDefs"] as const,
  overview: ["overview"] as const,
  alerts: ["alerts"] as const,
  trees: ["trees"] as const,
  tree: (id: string) => ["tree", id] as const,
  workers: ["workers"] as const,
  worker: (id: string) => ["worker", id] as const,
  logs: (f: LogFilters) => ["logs", f] as const,
  logGrades: (f: Omit<LogFilters, "page">) => ["logGrades", f] as const,
  log: (id: string) => ["log", id] as const,
  workerTree: (id: string) => ["workerTree", id] as const,
  myLogs: ["myLogs"] as const,
  managers: ["managers"] as const,
  myLog: (id: string) => ["myLog", id] as const,
};

// --- Shared ---

export function useTaskDefs() {
  return useQuery({
    queryKey: qk.taskDefs,
    queryFn: () => api<DbTaskDefinition[]>("/api/task-definitions"),
  });
}

/** Worker view of a tree: the tree plus its OPEN sets with live remaining counts. */
export function useWorkerTree(treeId: string) {
  return useQuery({
    queryKey: qk.workerTree(treeId),
    queryFn: () => api<{ tree: DbTree; sets: SetState[] }>(`/api/trees/${encodeURIComponent(treeId)}`),
    // Set counts change whenever anyone logs a harvest — keep this one fresh.
    staleTime: 0,
  });
}

// --- Dashboard (dashboard_snapshot RPC) ---

type RangeCounts = { today: number; week: number; month: number; year: number; all: number };

export interface Overview {
  generatedAt: string;
  staleDays: number;
  bounds: { today: string; week: string; month: string; year: string };
  zones: { zone: string; side: "L" | "R"; trees: number }[];
  logCounts: ({ zone: string; side: string } & RangeCounts)[];
  fruit: ({ zone: string; side: string; grade: string } & RangeCounts)[];
  alerts: {
    alert_id: string; tier: AlertTier; category: AlertCategory; subtype: string;
    tree_id: string | null; zone: string | null; side: string | null; created_at: string;
  }[];
  staleCounts: { zone: string; side: string; count: number }[];
  staleTrees: { tree_id: string; zone: string; side: string; last_log_at: string | null }[];
  overdueSets: {
    set_id: string; tree_id: string; zone: string; side: string; color: string;
    harvest_window_end: string; remaining: number;
  }[];
  recentLogs: {
    log_id: string; tree_id: string; zone: string; side: string; task_def_id: string;
    task_type: string; worker_name: string | null; submitted_at: string;
    validation_status: ValidationStatus; validation_flags: string[];
  }[];
}

export function useOverview() {
  return useQuery({
    queryKey: qk.overview,
    queryFn: () => api<Overview>("/api/manager/overview"),
    // The snapshot is cheap now (rollups), so let it refresh itself a little: a tab left
    // open overnight shouldn't keep showing yesterday as "today".
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

// --- Alerts ---

export type AlertRow = DbAlert & {
  trees: { tree_id: string; zone: string; side: string } | null;
  workers: { worker_id: string; users: { display_name: string } | null } | null;
};

export function useAlerts() {
  return useQuery({
    queryKey: qk.alerts,
    queryFn: () => api<{ alerts: AlertRow[] }>("/api/manager/alerts").then((r) => r.alerts),
  });
}

export type AlertStatusTab = Extract<AlertStatus, "open" | "resolved" | "dismissed">;

// --- Trees ---

export type TreeRow = Pick<DbTree, "tree_id" | "qr_code" | "zone" | "side" | "row_num" | "position" | "variety" | "status">
  & Pick<TreeSummary, "last_log_at" | "open_alerts" | "has_tier1_alert" | "open_sets">;

export function useTrees() {
  return useQuery({
    queryKey: qk.trees,
    queryFn: () => api<{ trees: TreeRow[] }>("/api/manager/trees").then((r) => r.trees),
  });
}

export interface TreeDetail {
  tree: DbTree;
  summary: TreeSummary | null;
  sets: SetState[];
  recentLogs: Pick<EffectiveTaskLog, "log_id" | "task_def_id" | "task_type" | "worker_name" | "submitted_at" | "validation_status" | "validation_flags">[];
  openAlerts: Pick<DbAlert, "alert_id" | "tier" | "category" | "subtype" | "created_at">[];
}

export function useTreeDetail(treeId: string) {
  return useQuery({
    queryKey: qk.tree(treeId),
    queryFn: () => api<TreeDetail>(`/api/manager/trees/${encodeURIComponent(treeId)}`),
  });
}

// --- Workers ---

export interface WorkerRow {
  worker_id: string;
  language: WorkerLanguage;
  active: boolean;
  trust_tier: WorkerTrustTier;
  created_at: string;
  users: { display_name: string } | null;
  reliability: WorkerReliability;
}

export function useWorkers() {
  return useQuery({
    queryKey: qk.workers,
    queryFn: () => api<{ workers: WorkerRow[] }>("/api/manager/workers").then((r) => r.workers),
  });
}

export interface WorkerDetail {
  worker: {
    worker_id: string; language: WorkerLanguage; active: boolean; trust_tier: WorkerTrustTier;
    trust_tier_set_by: string; trust_tier_changed_at: string;
    users: { id: string; display_name: string; role: string } | null;
  };
  recentLogs: Pick<EffectiveTaskLog, "log_id" | "task_def_id" | "task_type" | "tree_id" | "submitted_at" | "validation_status" | "validation_flags">[];
  reliability: WorkerReliability;
}

export function useWorkerDetail(workerId: string) {
  return useQuery({
    queryKey: qk.worker(workerId),
    queryFn: () => api<WorkerDetail>(`/api/manager/workers/${workerId}`),
  });
}

// --- Logs ---

export interface LogFilters {
  range: string;
  zone: string;
  task: string;
  worker: string;
  status: string;
  page: number;
}

export interface LogsPage {
  logs: Pick<EffectiveTaskLog, "log_id" | "tree_id" | "zone" | "side" | "task_def_id" | "task_type" | "worker_id" | "worker_name" | "submitted_at" | "validation_status" | "validation_flags" | "form_data" | "latest_correction_id">[];
  total: number;
  page: number;
  pageSize: number;
}

export function useLogs(filters: LogFilters) {
  const qs = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v !== "" && v !== undefined).map(([k, v]) => [k, String(v)]),
  );
  return useQuery({
    queryKey: qk.logs(filters),
    queryFn: () => api<LogsPage>(`/api/manager/logs?${qs}`),
    placeholderData: keepPreviousData,
  });
}

/** Fruit by grade for the Logs filters (rollup-backed). Independent of the page number. */
export function useLogGrades(filters: Omit<LogFilters, "page">, enabled: boolean) {
  const qs = new URLSearchParams(
    Object.entries({ ...filters, grades: "1" }).filter(([, v]) => v !== "").map(([k, v]) => [k, String(v)]),
  );
  return useQuery({
    queryKey: qk.logGrades(filters),
    queryFn: () => api<{ fruitByGrade: Record<string, number> }>(`/api/manager/logs?${qs}`).then((r) => r.fruitByGrade),
    enabled,
  });
}

export interface LogDetail {
  rootId: string;
  effective: EffectiveTaskLog | null;
  root: {
    log_id: string; tree_id: string; task_def_id: string; worker_id: string; submitted_at: string;
    gps_delta_meters: number | string | null; photo_url: string | null; validation_flags: string[];
    form_data: Record<string, unknown>; worker_name: string | null;
  };
  trail: {
    log_id: string; correction_type: "correction" | "void" | null; correction_reason: string | null;
    submitted_at: string; form_data: Record<string, unknown>;
    validation_status: ValidationStatus; validation_flags: string[];
  }[];
  alerts: { alert_id: string; tier: AlertTier; subtype: string; status: AlertStatus; created_at: string }[];
}

export function useLogDetail(logId: string) {
  return useQuery({ queryKey: qk.log(logId), queryFn: () => api<LogDetail>(`/api/manager/logs/${logId}`) });
}

// --- Owner: managers ---

export interface ManagerRow { id: string; displayName: string; email: string | null; active: boolean }

export function useManagers() {
  return useQuery({
    queryKey: qk.managers,
    queryFn: () => api<{ managers: ManagerRow[] }>("/api/owner/managers").then((r) => r.managers),
  });
}

// --- Worker: my records ---

export type MyLogRow = import("@/types/database").DbTaskLog & { amendmentCount: number; voided: boolean };

export function useMyLogs() {
  return useQuery({
    queryKey: qk.myLogs,
    queryFn: () => api<{ logs: MyLogRow[] }>("/api/my-logs").then((r) => r.logs),
    staleTime: 0, // a worker expects their just-submitted record to be there
  });
}

/** One of the worker's records with its full trail (original + corrections + void). */
export function useMyLogTrail(logId: string) {
  return useQuery({
    queryKey: qk.myLog(logId),
    queryFn: () => api<{ rootLogId: string; trail: import("@/types/database").DbTaskLog[] }>(`/api/my-logs/${logId}`),
    staleTime: 0,
  });
}
