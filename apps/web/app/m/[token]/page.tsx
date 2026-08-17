import type { CSSProperties } from 'react';

interface PublicMediaPayload {
  shareId: string;
  mediaId: string;
  eventName: string;
  mimeType: string;
  byteSize: number;
  capturedAt: string | null;
  downloadUrl: string;
  expiresAt: string;
}

function apiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_URL || 'https://khebooth-api.vercel.app/api').replace(/\/$/, '');
}

function sizeLabel(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1024 / 1024))} Mo`;
}

export default async function GuestMediaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  let media: PublicMediaPayload | null = null;

  try {
    const response = await fetch(`${apiBaseUrl()}/public/media/${encodeURIComponent(token)}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (response.ok) media = (await response.json()) as PublicMediaPayload;
  } catch {
    media = null;
  }

  if (!media) {
    return (
      <main style={styles.page}>
        <section style={styles.card}>
          <div style={styles.brand}>KHE BOOTH</div>
          <h1 style={styles.title}>Ce lien n’est plus disponible</h1>
          <p style={styles.copy}>Le QR a peut-être été révoqué ou le média n’est plus accessible. Demandez un nouveau QR à la régie SHARING.</p>
        </section>
      </main>
    );
  }

  const isImage = media.mimeType.startsWith('image/');
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>KHE BOOTH</div>
        <p style={styles.eyebrow}>VOTRE MOMENT</p>
        <h1 style={styles.title}>{media.eventName}</h1>
        <p style={styles.copy}>{media.capturedAt ? new Date(media.capturedAt).toLocaleString('fr-CH') : 'Moment KHE Booth'} • {sizeLabel(media.byteSize)}</p>

        <div style={styles.mediaShell}>
          {isImage ? (
            <img src={media.downloadUrl} alt="Moment KHE Booth" style={styles.image} />
          ) : (
            <video src={media.downloadUrl} controls playsInline preload="metadata" style={styles.video} />
          )}
        </div>

        <a href={media.downloadUrl} download style={styles.download}>Télécharger le média</a>
        <p style={styles.security}>Lien KHE Booth sécurisé. L’accès au fichier cloud est temporaire et renouvelé uniquement lorsque ce QR est ouvert.</p>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#101010', padding: '32px 16px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Arial, sans-serif' },
  card: { width: '100%', maxWidth: 760, background: '#ffffff', borderRadius: 24, padding: 24, boxSizing: 'border-box' },
  brand: { fontWeight: 900, letterSpacing: 3, fontSize: 13 },
  eyebrow: { margin: '24px 0 4px', fontSize: 11, fontWeight: 900, letterSpacing: 2, opacity: 0.55 },
  title: { margin: '0 0 8px', fontSize: 30, lineHeight: 1.1 },
  copy: { margin: '0 0 18px', opacity: 0.65, lineHeight: 1.5 },
  mediaShell: { background: '#000000', borderRadius: 18, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 260 },
  image: { display: 'block', width: '100%', maxHeight: '72vh', objectFit: 'contain' },
  video: { display: 'block', width: '100%', maxHeight: '72vh', background: '#000000' },
  download: { display: 'block', marginTop: 18, padding: '14px 18px', background: '#111111', color: '#ffffff', borderRadius: 12, textAlign: 'center', textDecoration: 'none', fontWeight: 900 },
  security: { margin: '14px 0 0', fontSize: 11, lineHeight: 1.5, opacity: 0.55, textAlign: 'center' },
};
