import type { CSSProperties } from 'react';

interface PublicMediaPayload {
  shareId: string;
  mediaId: string;
  displayName?: string | null;
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

function extensionFor(mimeType:string):string{
  if(mimeType==='image/jpeg')return'jpg';if(mimeType==='image/png')return'png';if(mimeType==='image/webp')return'webp';if(mimeType==='video/quicktime')return'mov';return'mp4';
}

function Brand() {
  return (
    <div style={styles.brandRow}>
      <div style={styles.logoFrame}><img src="/khe-logo.jpeg" alt="KHE Booth" style={styles.logo} /></div>
      <div><div style={styles.brand}>KHE BOOTH</div><div style={styles.slogan}>Votre événement, notre expertise</div></div>
    </div>
  );
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
          <Brand />
          <div style={styles.statusPill}>LIEN INVITÉ SÉCURISÉ</div>
          <h1 style={styles.title}>Ce Moment n’est plus disponible</h1>
          <p style={styles.copy}>Le QR a peut-être été révoqué ou le média n’est plus accessible. Demandez simplement un nouveau QR à la régie SHARING.</p>
        </section>
      </main>
    );
  }

  const isImage = media.mimeType.startsWith('image/');
  const displayName=media.displayName?.trim()||`KHE ${media.eventName} ${isImage?'Photo':'Vidéo'}`;
  const fileName=`${displayName}.${extensionFor(media.mimeType)}`;
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <Brand />
        <div style={styles.statusPill}>✓ MOMENT KHE SÉCURISÉ</div>
        <p style={styles.eyebrow}>VOTRE MOMENT</p>
        <h1 style={styles.title}>{displayName}</h1>
        <p style={styles.copy}>{media.eventName} • {media.capturedAt ? new Date(media.capturedAt).toLocaleString('fr-CH') : 'Moment KHE Booth'} • {sizeLabel(media.byteSize)}</p>

        <div style={styles.mediaShell}>
          {isImage ? (
            <img src={media.downloadUrl} alt={displayName} style={styles.image} />
          ) : (
            <video src={media.downloadUrl} controls playsInline preload="metadata" style={styles.video} />
          )}
        </div>

        <a href={media.downloadUrl} download={fileName} style={styles.download}>↓ Enregistrer ce Moment</a>
        <p style={styles.downloadHint}>Sur iPhone ou Android, ouvrez le fichier puis utilisez « Enregistrer » ou « Télécharger » si votre navigateur le demande.</p>
        <div style={styles.securityBox}>
          <strong style={styles.securityTitle}>Accès privé par QR</strong>
          <span style={styles.security}>Ce lien donne accès uniquement à ce Moment. Il peut être révoqué depuis la régie SHARING et le fichier est servi avec un accès temporaire sécurisé.</span>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: 'radial-gradient(circle at top right, rgba(215,178,76,.13), transparent 34%), #0b0c0f', color:'#f7f7f7', padding: '24px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Inter, Arial, sans-serif' },
  card: { width: '100%', maxWidth: 760, background: 'linear-gradient(180deg,#17191e 0%,#111216 100%)', border:'1px solid rgba(215,178,76,.35)', borderRadius: 26, padding: 'clamp(18px,4vw,30px)', boxSizing: 'border-box', boxShadow:'0 24px 80px rgba(0,0,0,.46), 0 0 38px rgba(215,178,76,.08)' },
  brandRow:{display:'flex',alignItems:'center',gap:12,marginBottom:22},
  logoFrame:{width:58,height:44,border:'1px solid rgba(215,178,76,.45)',borderRadius:12,overflow:'hidden',background:'#0b0c0f',flex:'0 0 auto'},
  logo:{display:'block',width:'100%',height:'100%',objectFit:'contain'},
  brand: { fontWeight: 950, letterSpacing: 3, fontSize: 13, color:'#f7df91' },
  slogan:{fontSize:10,opacity:.58,marginTop:3},
  statusPill:{display:'inline-block',padding:'7px 10px',borderRadius:999,background:'rgba(215,178,76,.1)',border:'1px solid rgba(215,178,76,.28)',color:'#f7df91',fontSize:9,fontWeight:900,letterSpacing:1.3},
  eyebrow: { margin: '22px 0 5px', fontSize: 10, fontWeight: 900, letterSpacing: 2.2, color:'#d7b24c' },
  title: { margin: '18px 0 9px', fontSize: 'clamp(25px,7vw,38px)', lineHeight: 1.08, color:'#ffffff' },
  copy: { margin: '0 0 20px', color:'#c7c9cf', lineHeight: 1.55, fontSize:14 },
  mediaShell: { background: '#050505', border:'1px solid rgba(255,255,255,.08)', borderRadius: 20, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240, boxShadow:'inset 0 0 30px rgba(0,0,0,.5)' },
  image: { display: 'block', width: '100%', maxHeight: '70vh', objectFit: 'contain' },
  video: { display: 'block', width: '100%', maxHeight: '70vh', background: '#000000' },
  download: { display: 'block', marginTop: 18, padding: '16px 18px', background: 'linear-gradient(135deg,#d7b24c,#f7df91)', color: '#151515', borderRadius: 14, textAlign: 'center', textDecoration: 'none', fontWeight: 950, boxShadow:'0 10px 28px rgba(215,178,76,.2)' },
  downloadHint:{margin:'9px 5px 0',fontSize:10,lineHeight:1.45,color:'#92959d',textAlign:'center'},
  securityBox:{marginTop:18,padding:'13px 14px',borderRadius:14,background:'rgba(255,255,255,.035)',border:'1px solid rgba(255,255,255,.07)',display:'flex',flexDirection:'column',gap:5},
  securityTitle:{fontSize:11,color:'#f7df91'},
  security: { fontSize: 10, lineHeight: 1.5, color:'#9ea1a9' },
};
