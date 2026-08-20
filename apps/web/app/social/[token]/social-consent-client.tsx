'use client';

import { useState, type CSSProperties } from 'react';

type SocialProvider = 'WHATSAPP' | 'TIKTOK' | 'FACEBOOK' | 'INSTAGRAM' | 'X' | 'TELEGRAM' | 'YOUTUBE';

export interface PublicSocialPayload {
  id: string;
  provider: SocialProvider;
  eventName: string;
  mimeType: string;
  capturedAt: string | null;
  accountUrl: string;
  capability: { messageDelivery: boolean; directPublishing: boolean; followVerification: string };
  consent: { delivery: boolean; publication: boolean; marketing: boolean };
  followVerificationStatus: string;
}

interface DeliveryPayload {
  mediaId: string;
  downloadUrl: string;
  expiresAt: string;
  provider: SocialProvider;
  accountUrl: string;
  capability: PublicSocialPayload['capability'];
  consent: PublicSocialPayload['consent'];
  reminders: { likeDueAt: string | null; commentDueAt: string | null };
}

const PROVIDER_META: Record<SocialProvider, { label: string; mark: string; color: string }> = {
  WHATSAPP: { label: 'WhatsApp', mark: 'W', color: '#25D366' },
  INSTAGRAM: { label: 'Instagram', mark: '◎', color: '#C13584' },
  FACEBOOK: { label: 'Facebook', mark: 'f', color: '#1877F2' },
  TIKTOK: { label: 'TikTok', mark: '♪', color: '#111111' },
  X: { label: 'X', mark: '𝕏', color: '#111111' },
  TELEGRAM: { label: 'Telegram', mark: '➤', color: '#229ED9' },
  YOUTUBE: { label: 'YouTube', mark: '▶', color: '#FF0000' },
};

export function SocialConsentClient({ initial, token, apiBaseUrl }: { initial: PublicSocialPayload; token: string; apiBaseUrl: string }) {
  const meta = PROVIDER_META[initial.provider];
  const [followAcknowledged, setFollowAcknowledged] = useState(!initial.accountUrl);
  const [delivery, setDelivery] = useState(true);
  const [publication, setPublication] = useState(initial.consent.publication);
  const [marketing, setMarketing] = useState(initial.consent.marketing);
  const [result, setResult] = useState<DeliveryPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function requestMedia() {
    if (!delivery) { setMessage('Votre accord est nécessaire uniquement pour vous remettre ce média.'); return; }
    if (initial.accountUrl && !followAcknowledged) { setMessage(`Abonnez-vous d’abord à la page ${meta.label}, puis confirmez ci-dessous.`); return; }
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${apiBaseUrl}/public/social/${encodeURIComponent(token)}/consent`, {
        method: 'PATCH',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ delivery, publication, marketing, followAcknowledged }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string | string[] };
        throw new Error(Array.isArray(body.message) ? body.message.join(', ') : body.message || `HTTP ${response.status}`);
      }
      setResult(await response.json() as DeliveryPayload);
      setMessage(initial.capability.messageDelivery
        ? `Votre demande est enregistrée pour ${meta.label}. Votre copie sécurisée est aussi disponible immédiatement ci-dessous.`
        : `${meta.label} ne permet pas ce type de remise par message via l’intégration KHE actuelle. Votre copie sécurisée est disponible ci-dessous.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de préparer votre média.');
    } finally { setBusy(false); }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <div style={styles.brand}>KHE BOOTH</div>
        <div style={styles.providerRow}>
          <div style={{ ...styles.providerMark, background: meta.color }}>{meta.mark}</div>
          <div><div style={styles.eyebrow}>PARTAGE SOCIAL</div><h1 style={styles.title}>{meta.label}</h1></div>
        </div>
        <p style={styles.copy}><strong>{initial.eventName}</strong>{initial.capturedAt ? ` • ${new Date(initial.capturedAt).toLocaleString('fr-CH')}` : ''}</p>

        {initial.accountUrl ? <div style={styles.stepCard}>
          <div style={styles.stepNumber}>1</div>
          <div style={styles.stepCopy}>
            <strong>Suivre la page {meta.label}</strong>
            <span style={styles.muted}>Ouvrez la page officielle KHE configurée pour cet événement.</span>
            <a href={initial.accountUrl} target="_blank" rel="noreferrer" style={{ ...styles.socialLink, background: meta.color }}>Ouvrir {meta.label}</a>
            <label style={styles.checkRow}><input type="checkbox" checked={followAcknowledged} onChange={(event) => setFollowAcknowledged(event.target.checked)} /><span>Je suis déjà abonné(e) ou je viens de m’abonner.</span></label>
            <span style={styles.tiny}>KHE vérifie automatiquement l’abonnement uniquement lorsque l’API du réseau le permet. Sinon cette confirmation est enregistrée sans prétendre à une vérification technique.</span>
          </div>
        </div> : null}

        <div style={styles.stepCard}>
          <div style={styles.stepNumber}>2</div>
          <div style={styles.stepCopy}>
            <strong>Choisir vos consentements</strong>
            <label style={styles.checkRow}><input type="checkbox" checked={delivery} onChange={(event) => setDelivery(event.target.checked)} /><span><b>Recevoir mon média</b> — nécessaire pour cette remise.</span></label>
            <label style={styles.checkRow}><input type="checkbox" checked={publication} onChange={(event) => setPublication(event.target.checked)} /><span>J’autorise KHE à publier ce média sur sa page sociale.</span></label>
            <label style={styles.checkRow}><input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} /><span>Je souhaite recevoir les annonces des événements publics KHE.</span></label>
            <span style={styles.tiny}>La publication et les messages promotionnels sont facultatifs et séparés de la remise de votre média.</span>
          </div>
        </div>

        <button type="button" disabled={busy} onClick={() => void requestMedia()} style={{ ...styles.submit, opacity: busy ? .6 : 1 }}>{busy ? 'PRÉPARATION…' : 'RECEVOIR MON MOMENT'}</button>
        {message ? <p style={styles.message}>{message}</p> : null}

        {result ? <div style={styles.result}>
          <div style={styles.resultTitle}>Votre Moment est prêt</div>
          <div style={styles.mediaShell}>
            {initial.mimeType.startsWith('image/') ? <img src={result.downloadUrl} alt="Moment KHE Booth" style={styles.image} /> : <video src={result.downloadUrl} controls playsInline autoPlay muted loop style={styles.video} />}
          </div>
          <a href={result.downloadUrl} download style={styles.download}>Télécharger le média</a>
          {publication ? <p style={styles.tiny}>Votre autorisation de publication est enregistrée. Le rappel d’engagement est planifié à +30 min, puis le rappel de commentaire à +24 h, uniquement si le canal connecté permet encore légalement et techniquement l’envoi.</p> : null}
        </div> : null}

        <p style={styles.security}>Votre média reste dans le stockage privé KHE. Le lien de téléchargement affiché ici expire automatiquement.</p>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: 'radial-gradient(circle at 10% 0%, #372d19 0, #101010 35%, #090909 100%)', padding: '28px 14px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily: 'Arial, sans-serif', boxSizing: 'border-box' },
  card: { width: '100%', maxWidth: 720, background: '#ffffff', borderRadius: 26, padding: 22, boxSizing: 'border-box', boxShadow: '0 24px 70px rgba(0,0,0,.35)' },
  brand: { color: '#9b7727', fontWeight: 900, letterSpacing: 3, fontSize: 12 },
  providerRow: { display: 'flex', gap: 12, alignItems: 'center', marginTop: 18 },
  providerMark: { width: 48, height: 48, borderRadius: 14, color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 900, fontSize: 24, border: '2px solid #fff', boxShadow: '0 5px 18px rgba(0,0,0,.16)' },
  eyebrow: { fontSize: 9, fontWeight: 900, letterSpacing: 2, opacity: .5 },
  title: { margin: '2px 0 0', fontSize: 28, lineHeight: 1 },
  copy: { margin: '12px 0 18px', opacity: .65, lineHeight: 1.5 },
  stepCard: { display: 'flex', gap: 12, padding: 14, border: '1px solid #e6e6e6', borderRadius: 16, marginTop: 10, background: '#fafafa' },
  stepNumber: { width: 30, height: 30, minWidth: 30, borderRadius: 15, background: '#111', color: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 900 },
  stepCopy: { display: 'flex', flexDirection: 'column', gap: 9, flex: 1 },
  muted: { fontSize: 13, opacity: .65, lineHeight: 1.4 },
  socialLink: { color: '#fff', textDecoration: 'none', borderRadius: 10, padding: '11px 13px', textAlign: 'center', fontWeight: 900, fontSize: 13 },
  checkRow: { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, lineHeight: 1.4, cursor: 'pointer' },
  tiny: { fontSize: 10, lineHeight: 1.5, opacity: .56 },
  submit: { width: '100%', border: 0, background: '#b31520', color: '#fff', borderRadius: 13, padding: '14px 18px', marginTop: 16, fontWeight: 900, letterSpacing: .5, cursor: 'pointer' },
  message: { margin: '12px 0 0', padding: 11, borderRadius: 11, background: '#f0eadc', fontSize: 12, lineHeight: 1.5 },
  result: { marginTop: 18, paddingTop: 18, borderTop: '1px solid #e7e7e7' },
  resultTitle: { fontSize: 20, fontWeight: 900, marginBottom: 10 },
  mediaShell: { background: '#000', borderRadius: 16, overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 },
  image: { display: 'block', width: '100%', maxHeight: '68vh', objectFit: 'contain' },
  video: { display: 'block', width: '100%', maxHeight: '68vh', background: '#000' },
  download: { display: 'block', marginTop: 12, padding: '13px 16px', background: '#111', color: '#fff', borderRadius: 11, textAlign: 'center', textDecoration: 'none', fontWeight: 900 },
  security: { margin: '16px 0 0', fontSize: 10, lineHeight: 1.5, opacity: .5, textAlign: 'center' },
};
