import type { Metadata } from 'next';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';
import AuthLayout from './components/AuthLayout';

export const metadata: Metadata = {
  title: 'Logistics Bot Dashboard',
  description: 'Monitor your WhatsApp logistics bot',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black">
        <SessionProvider>
          <AuthLayout>{children}</AuthLayout>
        </SessionProvider>
      </body>
    </html>
  );
}
