import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Montserrat } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'iNest Phone | Gerador de Contratos',
  description: 'Fundação inicial do Gerador de Contratos iNest Phone.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${montserrat.variable}`}>
      <body>
        <div className="app-shell min-h-screen bg-inest-ice text-inest-black">
          <header className="site-header">
            <span className="brand-name">iNest Phone</span>
            <span className="brand-context">Gerador de Contratos</span>
          </header>
          <main className="page-content">{children}</main>
        </div>
      </body>
    </html>
  );
}
