import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Achadinhos Festas • Looks de Natal e Réveillon',
  description: 'Vitrine oficial de looks de Natal e Réveillon com envio rápido e ofertas selecionadas.',
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

