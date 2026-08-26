'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export type MarketingCartPlan = {
  code: string;
  name: string;
  tagline: string;
  priceLabel: string;
};

const CART_KEY = 'khe.marketing.cart.v1';
const CART_EVENT = 'khe-marketing-cart-updated';

function readCart(): MarketingCartPlan | null {
  if (typeof window === 'undefined') return null;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CART_KEY) ?? 'null') as MarketingCartPlan | null;
    return parsed && typeof parsed.code === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 4h2l1.6 9.1a2 2 0 0 0 2 1.7h7.8a2 2 0 0 0 2-1.6L20 7H6.1M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

export function MarketingCart({ plans, currency }: { plans: MarketingCartPlan[]; currency: string }) {
  const [item, setItem] = useState<MarketingCartPlan | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItem(readCart());
    const refresh = (event: Event) => {
      setItem(readCart());
      if ((event as CustomEvent<{ open?: boolean }>).detail?.open) setOpen(true);
    };
    const closeOnOutside = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener(CART_EVENT, refresh);
    window.addEventListener('storage', refresh);
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener(CART_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  const current = item ? plans.find((plan) => plan.code === item.code) ?? item : null;
  const remove = () => {
    try { window.localStorage.removeItem(CART_KEY); } catch {}
    setItem(null);
    window.dispatchEvent(new CustomEvent(CART_EVENT));
  };

  return (
    <div className="marketing-cart" ref={rootRef}>
      <button
        type="button"
        className="marketing-cart-trigger"
        aria-label={current ? `Panier, 1 offre : ${current.name}` : 'Panier vide'}
        aria-expanded={open}
        aria-controls="khe-marketing-cart-panel"
        onClick={() => setOpen((value) => !value)}
      >
        <CartIcon />
        <span className="marketing-cart-label">Panier</span>
        {current ? <b aria-label="1 article">1</b> : null}
      </button>
      {open ? (
        <aside id="khe-marketing-cart-panel" className="marketing-cart-panel" aria-label="Votre panier">
          <div className="marketing-cart-head">
            <div>
              <span>VOTRE PANIER</span>
              <strong>{current ? '1 offre sélectionnée' : 'Aucune offre sélectionnée'}</strong>
            </div>
            <button type="button" aria-label="Fermer le panier" onClick={() => setOpen(false)}>×</button>
          </div>
          {current ? (
            <>
              <div className="marketing-cart-item">
                <div>
                  <strong>{current.name}</strong>
                  <p>{current.tagline}</p>
                </div>
                <b>{current.priceLabel}</b>
              </div>
              <p className="marketing-cart-note">Un abonnement à la fois. Choisir une autre offre remplacera celle-ci.</p>
              <Link className="marketing-cta marketing-cart-checkout" href={`/subscribe?plan=${encodeURIComponent(current.code)}&currency=${encodeURIComponent(currency)}`}>
                Continuer vers la souscription
              </Link>
              <button type="button" className="marketing-cart-remove" onClick={remove}>Retirer cette offre</button>
            </>
          ) : (
            <div className="marketing-cart-empty">
              <p>Comparez les formules et ajoutez celle qui correspond à votre activité.</p>
              <a className="marketing-ghost" href="#tarifs" onClick={() => setOpen(false)}>Voir les offres</a>
            </div>
          )}
        </aside>
      ) : null}
    </div>
  );
}

export function AddToCartButton({ plan }: { plan: MarketingCartPlan }) {
  const [added, setAdded] = useState(false);
  const add = () => {
    try { window.localStorage.setItem(CART_KEY, JSON.stringify(plan)); } catch {}
    setAdded(true);
    window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: { open: true } }));
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <button type="button" className="marketing-cta pricing-button add-cart-button" onClick={add}>
      {added ? '✓ Offre ajoutée' : 'Ajouter au panier'}
    </button>
  );
}
