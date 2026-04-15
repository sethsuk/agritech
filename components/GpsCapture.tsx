"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export type Coords = { latitude: number; longitude: number } | null;

export function useGpsCapture(): Coords {
  const [coords, setCoords] = useState<Coords>(null);
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      },
      () => {
        toast.info("ไม่สามารถระบุตำแหน่ง", { duration: 2000 });
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }, []);

  return coords;
}
