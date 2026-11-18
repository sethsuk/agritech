/**
 * Why a submission was hard-rejected — structured, never prose, so the form can name the
 * field in the worker's own language and highlight it (the old English strings like
 * "amount_kg above maximum 50" were shown verbatim to Thai and Burmese workers).
 */
export type RejectionCode =
  | "field_required"
  | "field_invalid_option"
  | "field_not_a_number"
  | "field_not_whole_number"
  | "field_below_min"
  | "field_above_max";

export interface Rejection {
  code: RejectionCode;
  /** field_id of the offending field. */
  field: string;
  /** For grade counters: which grade. */
  option?: string;
  /** For min/max violations: the limit that was crossed. */
  limit?: number;
}
