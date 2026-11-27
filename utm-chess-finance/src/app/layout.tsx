import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClubSync | Campus Club Operations, Attendance & Finance Portal',
  description:
    'All-in-one student club activities, QR attendance, carpool transport, equipment borrowing, and financial ledger.',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ClubSync',
  },
};

export const viewport: Viewport = {
  themeColor: '#059669',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('clubsync_dark')==='true'){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
        <style type="text/tailwindcss">{`@custom-variant dark (&:where(.dark, .dark *));`}</style>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" async></script>
      </head>
      <body
        className={`${inter.className} m-0 p-0 bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased min-h-screen selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-400/25 dark:selection:text-emerald-100`}
      >
        {children}
      </body>
    </html>
  );
}
