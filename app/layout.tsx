import type { Metadata } from "next";
import { Inter, Kanit } from "next/font/google";
import "./globals.css";
import { UserProvider } from "./context/UserContext";
import { GlobalThemeToggle } from "./components/GlobalThemeToggle";

const themeInitScript = `
  (() => {
    try {
      const saved = localStorage.getItem('math-by-seng-theme');
      const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch (_) {}
  })();
`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col transition-colors duration-300">
        <UserProvider>
          {children}
          <GlobalThemeToggle />
        </UserProvider>
      </body>
    </html>
  );
}
