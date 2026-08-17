'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { apiRequest, clearAccessToken, getAccessToken, setSessionUser } from '@/lib/api';
import { SupportCenterTools } from './support-center-tools';

type CurrentUser = {
  id: string;
  organizationId?: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  role: string;
};

type Language = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt';

const labels: Record<Language, Record<string, string>> = {
  fr: { dashboard: 'Dashboard', clients: 'Clients', events: 'Événements', presets: 'Presets', create: 'Créer', help: 'Aide / Messagerie', profile: 'Profil', settings: 'Paramètres', logout: 'Déconnexion', loading: 'Chargement de KHE Booth…' },
  en: { dashboard: 'Dashboard', clients: 'Clients', events: 'Events', presets: 'Presets', create: 'Create', help: 'Help / Messages', profile: 'Profile', settings: 'Settings', logout: 'Log out', loading: 'Loading KHE Booth…' },
  de: { dashboard: 'Dashboard', clients: 'Kunden', events: 'Veranstaltungen', presets: 'Vorlagen', create: 'Erstellen', help: 'Hilfe / Nachrichten', profile: 'Profil', settings: 'Einstellungen', logout: 'Abmelden', loading: 'KHE Booth wird geladen…' },
  it: { dashboard: 'Dashboard', clients: 'Clienti', events: 'Eventi', presets: 'Preset', create: 'Crea', help: 'Aiuto / Messaggi', profile: 'Profilo', settings: 'Impostazioni', logout: 'Disconnetti', loading: 'Caricamento KHE Booth…' },
  es: { dashboard: 'Dashboard', clients: 'Clientes', events: 'Eventos', presets: 'Presets', create: 'Crear', help: 'Ayuda / Mensajes', profile: 'Perfil', settings: 'Ajustes', logout: 'Cerrar sesión', loading: 'Cargando KHE Booth…' },
  pt: { dashboard: 'Dashboard', clients: 'Clientes', events: 'Eventos', presets: 'Predefinições', create: 'Criar', help: 'Ajuda / Mensagens', profile: 'Perfil', settings: 'Definições', logout: 'Terminar sessão', loading: 'A carregar KHE Booth…' },
};

function readLanguage(): Language {
  if (typeof window === 'undefined') return 'fr';
  const value = window.localStorage.getItem('khe.web.language');
  return value && value in labels ? value as Language : 'fr';
}

export function PortalShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);
  const [language, setLanguage] = useState<Language>('fr');

  useEffect(() => {
    setLanguage(readLanguage());
    const onLanguage = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && detail in labels) setLanguage(detail as Language);
    };
    window.addEventListener('khe-language-changed', onLanguage);
    return () => window.removeEventListener('khe-language-changed', onLanguage);
  }, []);

  useEffect(() => {
    if (!getAccessToken()) { router.replace('/login'); return; }
    apiRequest<CurrentUser>('/auth/me')
      .then((currentUser) => { setUser(currentUser); setSessionUser(currentUser); })
      .catch(() => { clearAccessToken(); router.replace('/login'); })
      .finally(() => setReady(true));
  }, [router]);

  const text = labels[language];
  const links = useMemo(() => [
    ['/dashboard', text.dashboard],
    ['/clients', text.clients],
    ['/events', text.events],
    ['/events/new', text.create],
    ['/presets', text.presets],
    ['/help', text.help],
    ['/profile', text.profile],
    ['/settings', text.settings],
  ] as const, [text]);

  if (!ready) return <main className="login"><div className="muted">{text.loading}</div></main>;

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email;

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand">KHE <span>Booth</span></div>
      <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Kurtis Hypnotic Events</div>
      <nav className="nav">
        {links.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
      </nav>
      <div style={{ marginTop: 32 }}>
        <div style={{ fontWeight: 800, fontSize: 13 }}>{displayName}</div>
        <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{user?.role}</div>
        <button className="button secondary" style={{ marginTop: 14, width: '100%' }} onClick={() => { clearAccessToken(); router.replace('/login'); }}>{text.logout}</button>
      </div>
    </aside>
    <SupportCenterTools />
    <main className="content">{children}</main>
  </div>;
}
