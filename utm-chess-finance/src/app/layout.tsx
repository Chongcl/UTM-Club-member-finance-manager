import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ClubSync Finance | Campus Club Budget & Expense Tracker',
  description:
    'Real-time student club budget allocations, AI OCR receipt scanning, and reimbursement claim approvals.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.className} bg-[#f2fbf6] text-slate-800 antialiased min-h-screen selection:bg-emerald-600 selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}