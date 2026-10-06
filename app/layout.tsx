import type { Metadata } from "next";
import {
  Atkinson_Hyperlegible_Mono,
  Atkinson_Hyperlegible_Next,
  Imbue,
} from "next/font/google";
import "./globals.css";

// Imbue for titles, Atkinson Hyperlegible for reading and typing, its mono only for codes;
// see tech-docs/ui.md.
const imbue = Imbue({
  variable: "--font-imbue",
  subsets: ["latin"],
  axes: ["opsz"],
});

// Next has no metrics for the Atkinson faces to size a fallback font with, so name one instead.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
  fallback: ["system-ui", "sans-serif"],
  adjustFontFallback: false,
});

const atkinsonMono = Atkinson_Hyperlegible_Mono({
  variable: "--font-atkinson-mono",
  subsets: ["latin"],
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "todo-cat",
  description: "A to-do list kept by Lissie, a cat with attitude.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${imbue.variable} ${atkinson.variable} ${atkinsonMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
