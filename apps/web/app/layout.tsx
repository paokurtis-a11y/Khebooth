import type { Metadata } from 'next';
import { WebDisplayPreferenceBootstrap } from '@/components/web-display-preferences';
import { WebI18nBridge } from '@/components/web-i18n-bridge';
import { WebStartupIntro } from '@/components/web-startup-intro';
import './globals.css';
import './responsive-fixes.css';
import './site-editor.css';
import './portal-polish.css';
import './portal-navigation.css';

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
      <body><WebDisplayPreferenceBootstrap /><WebI18nBridge /><WebStartupIntro />{children}</body>
    </html>
  );
}
