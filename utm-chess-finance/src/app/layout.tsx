import type { Metadata, Viewport } from 'next';
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-inter' });
const plusJakarta = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-jakarta' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-mono' });

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
    <html
      lang="en"
      className={`${inter.variable} ${plusJakarta.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
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
        className={`${inter.className} font-sans m-0 p-0 bg-[var(--bg-canvas)] text-[var(--text-primary)] antialiased min-h-screen selection:bg-emerald-500/20 selection:text-emerald-900 dark:selection:bg-emerald-400/25 dark:selection:text-emerald-100`}
      >
        {children}
      </body>
    </html>
  );
}
