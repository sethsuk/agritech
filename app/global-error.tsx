"use client";

/**
 * Last-resort boundary for a crash in the root layout itself — the providers (language,
 * data) may be what failed, so this renders its own <html> and shows all three languages.
 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="th">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f0", color: "#2b2318", margin: 0 }}>
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "64px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 48 }}>⚠️</div>
          <h1 style={{ fontSize: 20 }}>เกิดข้อผิดพลาด · အမှားတစ်ခု ဖြစ်ပွားခဲ့သည် · Something went wrong</h1>
          <button
            onClick={reset}
            style={{ marginTop: 24, width: "100%", height: 60, borderRadius: 8, border: 0, background: "#1b5e20", color: "#fff", fontSize: 18, fontWeight: 600 }}
          >
            ลองอีกครั้ง · ထပ်စမ်းရန် · Try again
          </button>
        </main>
      </body>
    </html>
  );
}
