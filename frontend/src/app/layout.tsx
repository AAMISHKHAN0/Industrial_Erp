import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./globals.css";
import { Providers } from "@/providers/providers";

export const metadata: Metadata = {
  title: "Industrial ERP | Digitalerena",
  description: "Enterprise Resource Planning for Industrial Manufacturing — Powered by Digitalerena (digitalerena.com)",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{
          __html: `document.querySelectorAll("[bis_skin_checked]").forEach(e=>e.removeAttribute("bis_skin_checked"))`,
        }} />
      </head>
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}