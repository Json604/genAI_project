import type { Metadata } from "next";
import { Space_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Catalogue Intelligence",
  description: "Multimodal product search and catalogue analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceMono.variable}>
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
