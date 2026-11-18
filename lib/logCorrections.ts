/** HTTP status for each error code correct_task_log / void_task_log can return. */
export const CORRECTION_ERROR_STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  already_voided: 409,
  locked_field: 422,
  set_has_activity: 409,
};
