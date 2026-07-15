import QRCode from "qrcode";

// Generates a printable label PNG (QR code + tree ID underneath) and triggers a download.
// Runs entirely client-side via <canvas> — no server-side image rendering involved.
export async function downloadTreeQrLabel(treeId: string, qrValue: string): Promise<void> {
  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, qrValue, { width: 480, margin: 2 });

  const labelHeight = 64;
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = qrCanvas.width;
  labelCanvas.height = qrCanvas.height + labelHeight;

  const ctx = labelCanvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
  ctx.drawImage(qrCanvas, 0, 0);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 40px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(treeId, labelCanvas.width / 2, qrCanvas.height + labelHeight / 2);

  const blob = await new Promise<Blob | null>((resolve) => labelCanvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Failed to generate label image");

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qr_${treeId}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
