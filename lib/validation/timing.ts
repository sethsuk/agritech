import type { DbTaskDefinition } from "@/types/database";

export function checkTiming(params: {
  formOpenedAt: Date;
  qrScannedAt: Date;
  submittedAt: Date;
  taskDef: DbTaskDefinition;
}): string[] {
  const flags: string[] = [];
  const { formOpenedAt, qrScannedAt, submittedAt, taskDef } = params;

  const completionSecs = (submittedAt.getTime() - formOpenedAt.getTime()) / 1000;
  if (completionSecs < taskDef.min_completion_seconds) {
    flags.push("completion_too_fast");
  }

  const qrToSubmitSecs = (submittedAt.getTime() - qrScannedAt.getTime()) / 1000;
  if (qrToSubmitSecs < taskDef.min_qr_to_submit_seconds) {
    flags.push("qr_to_submit_too_fast");
  }

  return flags;
}
