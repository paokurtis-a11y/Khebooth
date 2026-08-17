import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'KHE Booth — Capture, partage et expérience événementielle',
    template: '%s · KHE Booth',
  },
  description: 'KHE Booth par Kurtis Hypnotic Events : capture photo et vidéo, stations CAPTURE et SHARING, Studio créatif, cloud et QR invité sécurisé pour les professionnels de l’événementiel.',
  keywords: ['photobooth', 'photobooth 360', 'événementiel', 'partage photo', 'partage vidéo', 'KHE Booth', 'Kurtis Hypnotic Events'],
  applicationName: 'KHE Booth',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
