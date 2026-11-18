"use client";

import { useT } from "@/lib/i18n/LanguageContext";
import { RouteMessage } from "@/components/RouteStates";

export default function NotFound() {
  const { tr } = useT();
  return <RouteMessage icon="🌳" title={tr("notFoundTitle")} body={tr("notFoundBody")} />;
}
