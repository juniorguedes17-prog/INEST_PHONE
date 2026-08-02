import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/providers/app-providers';

export const metadata: Metadata = {
  title: 'iNest Phone | Gestao Comercial',
  description: 'Plataforma comercial iNest Phone.',
  applicationName: 'iNest Phone',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
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
        width: 1080,
        height: 1080,
        alt: 'Logo oficial iNest Phone',
      },
    ],
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
