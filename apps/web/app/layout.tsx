import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: 'iNest Phone | Gestao Comercial',
  description: 'Plataforma comercial iNest Phone.',
  applicationName: 'iNest Phone',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
    apple: [{ url: '/icon.png', sizes: '512x512', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'iNest Phone',
    statusBarStyle: 'default',
  },
  openGraph: {
    title: 'iNest Phone | Gestao Comercial',
    description: 'Plataforma comercial iNest Phone.',
    images: [
      {
        url: '/brand/inest-phone-logo.png',
        width: 1200,
        height: 1200,
        alt: 'Logo oficial iNest Phone',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'iNest Phone | Gestao Comercial',
    description: 'Plataforma comercial iNest Phone.',
    images: ['/brand/inest-phone-logo.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
