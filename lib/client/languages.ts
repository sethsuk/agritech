import type { WorkerLanguage } from "@/types/database";

/** Language choices, each written in its own script so a worker can find theirs. */
export const LANGUAGES: { value: WorkerLanguage; label: string }[] = [
  { value: "my", label: "မြန်မာ" },
  { value: "th", label: "ไทย" },
  { value: "en", label: "English" },
];
