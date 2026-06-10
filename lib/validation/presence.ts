import type { DbTree } from "@/types/database";

function haversineMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const GPS_TOLERANCE_METERS = Number(process.env.GPS_TOLERANCE_METERS ?? 15);

export function checkPresence(params: {
  qrValue: string;
  tree: DbTree;
  gpsLat: number | null;
  gpsLong: number | null;
}): { flags: string[]; gpsDistanceMeters: number | null } {
  const flags: string[] = [];
  let gpsDistanceMeters: number | null = null;

  if (params.qrValue !== params.tree.qr_code) {
    flags.push("qr_mismatch");
  }

  if (params.gpsLat === null || params.gpsLong === null) {
    flags.push("gps_missing");
  } else {
    gpsDistanceMeters = haversineMeters(
      params.gpsLat, params.gpsLong,
      Number(params.tree.lat), Number(params.tree.long),
    );
    if (gpsDistanceMeters > GPS_TOLERANCE_METERS) {
      flags.push("gps_off_tree");
    }
  }

  return { flags, gpsDistanceMeters };
}
