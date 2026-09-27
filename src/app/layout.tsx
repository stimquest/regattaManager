import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter } from 'next/font/google';
import './globals.css';
import { AppLayout } from '@/components/layout/app-layout';
import FirebaseClientProvider from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { SerwistProvider } from '@serwist/turbopack/react';

// Polices auto-hébergées par Next : disponibles hors ligne dans la PWA.
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap', weight: ['500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'Régate · Comité de course',
  description: 'Inscriptions, arrivées et classements de vos régates, même sans réseau sur l’eau.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: 'Régate',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F8F7F4' },
    { media: '(prefers-color-scheme: dark)', color: '#080F16' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={`${sans.variable} ${display.variable}`}>
      <body className="font-body antialiased">
        {/* Pas de rechargement au retour du réseau : il ferait perdre une saisie d'arrivées en cours. */}
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NODE_ENV === 'development'} cacheOnNavigation reloadOnOnline={false}>
          <FirebaseClientProvider>
            <AppLayout>{children}</AppLayout>
            <Toaster />
          </FirebaseClientProvider>
        </SerwistProvider>
      </body>
    </html>
  );
}
