
import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import FirebaseClientProvider from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'Gestionnaire de Régate de Windsurf',
  description: 'Gérez vos régates de windsurf facilement, de l\'inscription des participants aux résultats en temps réel.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <FirebaseClientProvider>
          <AppLayout>{children}</AppLayout>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
