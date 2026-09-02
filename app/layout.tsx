import type { Metadata } from "next";
import { Inter, Kanit } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./context/UserContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Math by Seng | LMS Platform",
  description: "ระบบการเรียนรู้ออนไลน์ที่ทันสมัยและเข้าใจง่าย สำหรับหลากหลายรายวิชา",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${inter.variable} ${kanit.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col transition-colors duration-300">
        <UserProvider>
          {children}
        </UserProvider>
      </body>
    </html>
  );
}
