import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';

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
    <html lang="en">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4" async></script>
      </head>
      <body
        className={`${inter.className} m-0 p-0 bg-[#f4fbf7] text-slate-800 antialiased min-h-screen selection:bg-emerald-600 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
