import type { Metadata, Viewport } from 'next';
import { Montserrat, Open_Sans } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers/Providers';

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  display: 'swap',
});

const openSans = Open_Sans({
  subsets: ['latin'],
  variable: '--font-open-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Fundamenta Leilões - Inteligência em Leilões de Imóveis',
  description: 'Plataforma de inteligência para investidores em leilões de imóveis. Análise de documentos por IA, calculadora financeira e oportunidades de todo o Brasil.',
  keywords: 'leilão imóveis, leilão judicial, leilão extrajudicial, investimento imóveis, análise leilão',
  authors: [{ name: 'Fundamenta Leilões' }],
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Fundamenta Leilões',
    description: 'Inteligência em Leilões de Imóveis',
    type: 'website',
    locale: 'pt_BR',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A2E50',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${montserrat.variable} ${openSans.variable}`}>
      <body style={{ fontFamily: 'var(--font-open-sans, "Open Sans", sans-serif)' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
