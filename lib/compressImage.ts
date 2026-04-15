"use client";

import imageCompression from "browser-image-compression";

export async function compressForUpload(file: File): Promise<File> {
  const compressed = await imageCompression(file, {
    maxSizeMB: 1,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    initialQuality: 0.8,
    fileType: "image/jpeg",
  });
  return new File([compressed], `${Date.now()}.jpg`, { type: "image/jpeg" });
}
