'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest, clearAccessToken, getAccessToken, setSessionUser } from '@/lib/api';

type CurrentUser = {
  id: string;
  email: string;
  role: string;
};

export function PortalShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }

    apiRequest<CurrentUser>('/auth/me')
      .then((currentUser) => {
        setUser(currentUser);
        setSessionUser(currentUser);
      })
      .catch(() => {
        clearAccessToken();
        router.replace('/login');
      })
      .finally(() => setReady(true));
  }, [router]);

  if (!ready) {
    return <main className="login"><div className="muted">Chargement de KHE Booth…</div></main>;
  }

  const links = [
    ['/dashboard', 'Dashboard'],
    ['/clients', 'Clients'],
    ['/events', 'Événements'],
    ['/presets', 'Presets'],
    ['/events/new', 'Créer'],
  ] as const;

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">KHE <span>Booth</span></div>
        <div className="muted" style={{ marginTop: 6, fontSize: 13 }}>Kurtis Hypnotic Events</div>
        <nav className="nav">
          {links.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: 32 }}>
          <div className="muted" style={{ fontSize: 12 }}>{user?.email}</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>{user?.role}</div>
          <button
            className="button secondary"
            style={{ marginTop: 14, width: '100%' }}
            onClick={() => {
              clearAccessToken();
              router.replace('/login');
            }}
          >
            Déconnexion
          </button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
