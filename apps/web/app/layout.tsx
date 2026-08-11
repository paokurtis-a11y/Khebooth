import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KHE Booth',
  description: 'Portail événementiel KHE Booth',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
