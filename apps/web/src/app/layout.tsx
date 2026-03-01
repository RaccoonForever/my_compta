import type { Metadata } from 'next';
import './globals.css';
import { NavBar } from '@/components/NavBar';
import { QueryProvider } from '@/providers/QueryProvider';
import { AuthProvider } from '@/hooks/useAuth';
import { AuthGuard } from '@/components/AuthGuard';

export const metadata: Metadata = {
  title: 'MyCompta',
  description: 'Personal cash-flow accountability',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          <QueryProvider>
            <AuthGuard>
              <NavBar />
              <main className="pt-14 min-h-screen">
                {children}
              </main>
            </AuthGuard>
          </QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
