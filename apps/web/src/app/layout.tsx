import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Boma Creative Studio",
  description: "On-brand design, campaigns and AI copy, coordinated by your Chief of Staff.",
};

// Fonts are loaded as stylesheets (not next/font) so the canvas exporter can use them too.
const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400..800;1,9..40,400..800&family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=Manrope:wght@400..800&family=Playfair+Display:wght@400..900&family=Space+Grotesk:wght@400..700&family=Bebas+Neue&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body className="aurora min-h-screen">{children}</body>
    </html>
  );
}
