/**
 * One-shot high-accuracy GPS read, shared by the tree forms. Resolves with the fix and
 * its accuracy radius so the UI can show "±8 m" — a bare "✓" gave no sense of quality.
 */
export interface GpsFix {
  lat: number;
  long: number;
  accuracyMeters: number;
}

export type GpsError = "unsupported" | "denied" | "unavailable";

export function readGps(timeoutMs = 15_000): Promise<GpsFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject("unsupported" satisfies GpsError);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        long: pos.coords.longitude,
        accuracyMeters: Math.round(pos.coords.accuracy),
      }),
      (err) => reject((err.code === err.PERMISSION_DENIED ? "denied" : "unavailable") satisfies GpsError),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}
