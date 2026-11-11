import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Mercado Livre Achados • Vitrine Oficial de Ofertas',
  description: 'Vitrine oficial Mercado Livre Achados: looks de festa, decoração e tecnologia com frete grátis.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased bg-gray-100 text-gray-900">
        {children}
      </body>
    </html>
  );
}

