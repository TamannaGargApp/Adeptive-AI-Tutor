import type { Metadata } from "next";
import { Atkinson_Hyperlegible, JetBrains_Mono } from "next/font/google";

import { AuthProvider } from "@/lib/auth";

import "./globals.css";

// Atkinson Hyperlegible was designed for maximum legibility, which suits learners reading
// explanations; JetBrains Mono is used only for Python code.
const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-atkinson",
});
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Adaptive AI Tutor",
  description: "Learn Python through personalized explanations, practice, quizzes, and intelligent feedback.",
};

// Runs before the page is painted, so a saved dark theme never flashes light first.
// With no saved choice, the CSS follows the device's light/dark setting.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script may set data-theme before React loads.
    <html lang="en" className={`${atkinson.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}