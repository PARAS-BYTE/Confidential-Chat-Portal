import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CCP - Confidential Communication Portal",
  description: "Secure, confidential text-based communication portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-bg-app text-text-primary antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
