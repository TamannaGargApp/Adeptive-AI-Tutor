import type { Metadata } from "next";
import { AuthProvider } from "@/lib/auth";

import "./globals.css";

// Atkinson Hyperlegible was designed for maximum legibility, which suits learners reading
// explanations; JetBrains Mono is used only for code.
//
// The fonts load from Google Fonts' own stylesheet rather than next/font. next/font downloads one
// copy of each font at build time, without the hinting Windows uses to snap letters to the pixel
// grid, which made text look soft or blurry on Windows. Google's stylesheet sends each browser the
// right version (hinted for Windows).
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=JetBrains+Mono:wght@400;600&display=swap";

export const metadata: Metadata = {
  title: "Adaptive AI Tutor",
  description: "Learn Python and JavaScript through personalized explanations, practice, quizzes, and intelligent feedback.",
};

// Runs before the page is painted, so a saved dark theme never flashes light first.
// With no saved choice, the CSS follows the device's light/dark setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may set data-theme before React loads.
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS_URL} />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions such as Grammarly add attributes to <body>
          before React loads, which would otherwise log a harmless hydration warning. */}
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}