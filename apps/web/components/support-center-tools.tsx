'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api';

type NotificationItem = {
  id: string;
  kind: string;
  title: string;
  body: string;
  actionUrl?: string | null;
  publishedAt: string;
  read: boolean;
};

type NotificationPayload = {
  preferences: {
    notificationsEnabled: boolean;
    productUpdatesEnabled: boolean;
    supportNotificationsEnabled: boolean;
  };
  unreadCount: number;
  items: NotificationItem[];
};

export function SupportCenterTools() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPayload | null>(null);

  const refresh = () => {
    apiRequest<NotificationPayload>('/support/notifications').then(setData).catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const updatePreference = async (key: keyof NotificationPayload['preferences'], value: boolean) => {
    await apiRequest('/support/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ [key]: value }),
    });
    refresh();
  };

  const markRead = async (item: NotificationItem) => {
    if (!item.read) {
      await apiRequest(`/support/notifications/${item.id}/read`, { method: 'POST' });
      refresh();
    }
  };

  return (
    <div style={{ position: 'fixed', top: 18, right: 24, zIndex: 40, display: 'flex', gap: 10, alignItems: 'center' }}>
      <Link className="button secondary" href="/help" style={{ padding: '9px 12px' }}>
        Help / KHE
      </Link>
      <div style={{ position: 'relative' }}>
        <button
          className="button secondary"
          aria-label="Notifications"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          style={{ width: 44, height: 42, padding: 0, position: 'relative' }}
        >
          🔔
          {(data?.unreadCount ?? 0) > 0 ? (
            <span
              style={{
                position: 'absolute',
                right: -5,
                top: -7,
                minWidth: 20,
                height: 20,
                borderRadius: 10,
                background: '#b42318',
                color: '#fff',
                fontSize: 11,
                display: 'grid',
                placeItems: 'center',
                padding: '0 5px',
              }}
            >
              {data?.unreadCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div
            className="card"
            style={{
              position: 'absolute',
              right: 0,
              top: 50,
              width: 'min(390px, calc(100vw - 32px))',
              maxHeight: '75vh',
              overflow: 'auto',
              padding: 16,
              boxShadow: '0 18px 45px rgba(0,0,0,.24)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <strong>Notifications</strong>
                <div className="muted" style={{ fontSize: 12 }}>Nouveautés et informations KHE Booth</div>
              </div>
              <button className="button secondary" onClick={() => setOpen(false)} style={{ padding: '6px 9px' }}>×</button>
            </div>

            <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>Notifications</span>
                <input
                  type="checkbox"
                  checked={data?.preferences.notificationsEnabled ?? true}
                  onChange={(event) => updatePreference('notificationsEnabled', event.target.checked)}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>Nouveautés produit</span>
                <input
                  type="checkbox"
                  checked={data?.preferences.productUpdatesEnabled ?? true}
                  disabled={!data?.preferences.notificationsEnabled}
                  onChange={(event) => updatePreference('productUpdatesEnabled', event.target.checked)}
                />
              </label>
              <label style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span>Support</span>
                <input
                  type="checkbox"
                  checked={data?.preferences.supportNotificationsEnabled ?? true}
                  disabled={!data?.preferences.notificationsEnabled}
                  onChange={(event) => updatePreference('supportNotificationsEnabled', event.target.checked)}
                />
              </label>
            </div>

            <div style={{ borderTop: '1px solid rgba(127,127,127,.25)', marginTop: 14, paddingTop: 10 }}>
              {(data?.items.length ?? 0) === 0 ? (
                <div className="muted" style={{ padding: '16px 0' }}>Aucune notification pour le moment.</div>
              ) : (
                data?.items.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => markRead(item)}
                    style={{
                      padding: '11px 8px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: item.read ? 'transparent' : 'rgba(255, 194, 74, .08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong style={{ fontSize: 14 }}>{item.title}</strong>
                      {!item.read ? <span title="Non lu">●</span> : null}
                    </div>
                    <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{item.body}</div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 5 }}>
                      {new Date(item.publishedAt).toLocaleString('fr-CH')}
                    </div>
                    {item.actionUrl ? <Link href={item.actionUrl}>Ouvrir</Link> : null}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
