import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quantedits — AI Creator Dashboard",
  description:
    "The generative AI workspace for creators. Deep-Dub into 150 languages, auto-cut TikTok highlights, and publish to Quanttube, Quantchill, and Quantads in one click.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
