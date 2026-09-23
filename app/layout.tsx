import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Thai, Noto_Sans_Myanmar } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import "./globals.css";

// One coordinated Noto family per script — no single typeface has well-designed
// glyphs across Latin, Thai and Burmese. Declared as a single CSS stack (see
// --font-sans in globals.css) so the renderer substitutes per glyph; never swap
// the whole font per screen or language.
//
// Three weights only (400/600/700) — light weights lose stroke definition in
// direct sunlight and for low-vision readers. next/font requires literal weights,
// so the list is repeated rather than shared.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  subsets: ["thai"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-thai",
  display: "swap",
});

// Burmese was previously not loaded at all — it fell back to whatever the device
// had, which on older/budget hardware means tofu boxes or Zawgyi-mapped glyphs.
// Shipping the Unicode webfont is what makes Burmese render reliably.
const notoMyanmar = Noto_Sans_Myanmar({
  subsets: ["myanmar"],
  weight: ["400", "600", "700"],
  variable: "--font-noto-myanmar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบบริหารสวนทุเรียน",
  description: "ระบบบันทึกและตรวจสอบการดูแลสวนทุเรียน",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1b5e20",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="th"
      className={`${notoSans.variable} ${notoThai.variable} ${notoMyanmar.variable}`}
    >
      <body className="min-h-dvh">
        <LanguageProvider>
          {children}
          <Toaster position="top-center" richColors closeButton duration={3000} />
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  );
}
