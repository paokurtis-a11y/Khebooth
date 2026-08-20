import type { CSSProperties } from 'react';
import { SocialConsentClient, type PublicSocialPayload } from './social-consent-client';

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://khebooth-api.vercel.app/api').replace(/\/$/, '');
}

export default async function SocialSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let social: PublicSocialPayload | null = null;
  const api = apiBaseUrl();

  try {
    const response = await fetch(`${api}/public/social/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) social = await response.json() as PublicSocialPayload;
  } catch {
    social = null;
  }

  if (!social) {
    return <main style={styles.page}><section style={styles.card}><div style={styles.brand}>KHE BOOTH</div><h1 style={styles.title}>Ce QR social n’est plus disponible</h1><p style={styles.copy}>Le Moment a peut-être été supprimé ou le lien n’est plus actif. Demandez un nouveau QR à la station SHARING.</p></section></main>;
  }

  return <SocialConsentClient initial={social} token={token} apiBaseUrl={api} />;
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#101010', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Arial, sans-serif' },
  card: { width: '100%', maxWidth: 680, background: '#fff', borderRadius: 24, padding: 24, boxSizing: 'border-box' },
  brand: { color: '#9b7727', fontWeight: 900, letterSpacing: 3, fontSize: 12 },
  title: { margin: '20px 0 8px', fontSize: 28 },
  copy: { margin: 0, opacity: .65, lineHeight: 1.5 },
};
