"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  onDecode: (text: string) => void;
  /** Called once if the camera is denied or unavailable. */
  onUnavailable?: (reason: string) => void;
};

const REGION_ID = "qr-scanner-region";

export function QrScanner({ onDecode, onUnavailable }: Props) {
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const startedRef = useRef(false);
  const onDecodeRef = useRef(onDecode);
  const onUnavailableRef = useRef(onUnavailable);

  useEffect(() => {
    onDecodeRef.current = onDecode;
    onUnavailableRef.current = onUnavailable;
  }, [onDecode, onUnavailable]);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let scanner: { stop: () => Promise<void>; clear: () => void } | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode(REGION_ID, { verbose: false });
        scanner = instance;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decoded) => {
            onDecodeRef.current(decoded);
          },
          () => {
            // Per-frame decode failures are noisy; ignore.
          },
        );
        if (cancelled) {
          await instance.stop().catch(() => {});
          return;
        }
        setStatus("ready");
      } catch (err) {
        const reason = err instanceof Error ? err.message : "unknown";
        setStatus("unavailable");
        onUnavailableRef.current?.(reason);
      }
    })();

    return () => {
      cancelled = true;
      if (scanner) {
        scanner.stop().catch(() => {}).finally(() => {
          try {
            scanner?.clear();
          } catch {}
        });
      }
    };
  }, []);

  if (status === "unavailable") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
        <div className="text-3xl">📷</div>
        <p className="mt-2 font-medium text-amber-900">
          ไม่สามารถเข้าถึงกล้อง
        </p>
        <p className="mt-1 text-sm text-amber-800">
          กรุณาใช้ช่องพิมพ์รหัสด้านล่างแทน
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-black">
      <div id={REGION_ID} className="aspect-square w-full" />
      {status === "loading" && (
        <div className="bg-black p-4 text-center text-sm text-white/70">
          กำลังเปิดกล้อง...
        </div>
      )}
    </div>
  );
}
