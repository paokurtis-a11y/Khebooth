'use client';

import {
  PAYMENT_STATUSES,
  SUBSCRIPTION_CATALOG,
  SUBSCRIPTION_STATUSES,
  subscriptionPlanLabel,
  type PaymentStatus,
  type SubscriptionPlan,
  type SubscriptionStatus,
} from '@khe/contracts';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type ClientItem = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  notes?: string | null;
  subscriptionPlan?: SubscriptionPlan;
  subscriptionStatus?: SubscriptionStatus;
  paymentStatus?: PaymentStatus;
  subscriptionStartedAt?: string | null;
  subscriptionEndsAt?: string | null;
};

const subscriptionStatusLabels: Record<SubscriptionStatus, string> = {PROSPECT:'Prospect',PLAN_SELECTED:'Offre choisie',PAYMENT_PENDING:'Paiement en attente',ACTIVE:'Actif',SUSPENDED:'Suspendu',CANCELLED:'Résilié'};
const paymentStatusLabels: Record<PaymentStatus, string> = {UNPAID:'Non payé',PENDING:'En attente',PAID:'Payé',OVERDUE:'En retard',REFUNDED:'Remboursé'};

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientItem[]>([]);const [firstName, setFirstName] = useState('');const [lastName, setLastName] = useState('');const [email, setEmail] = useState('');const [phone, setPhone] = useState('');const [companyName, setCompanyName] = useState('');const [notes, setNotes] = useState('');const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('DISCOVERY');const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus>('PROSPECT');const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNPAID');const [subscriptionEndsAt, setSubscriptionEndsAt] = useState('');const [editingId, setEditingId] = useState<string | null>(null);const [canDelete, setCanDelete] = useState(false);const [error, setError] = useState('');const [message, setMessage] = useState('');const [submitting, setSubmitting] = useState(false);

  const loadClients = useCallback(() => {apiRequest<ClientItem[]>('/clients').then(setClients).catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));}, []);
  useEffect(() => {const role = getSessionUser()?.role;setCanDelete(role === 'OWNER' || role === 'ADMIN');loadClients();}, [loadClients]);
  function resetForm() {setEditingId(null);setFirstName('');setLastName('');setEmail('');setPhone('');setCompanyName('');setNotes('');setSubscriptionPlan('DISCOVERY');setSubscriptionStatus('PROSPECT');setPaymentStatus('UNPAID');setSubscriptionEndsAt('');}
  function editClient(client: ClientItem) {const fallback = client.name.trim().split(/\s+/);setEditingId(client.id);setFirstName(client.firstName ?? fallback[0] ?? '');setLastName(client.lastName ?? fallback.slice(1).join(' ') ?? '');setEmail(client.email ?? '');setPhone(client.phone ?? '');setCompanyName(client.companyName ?? '');setNotes(client.notes ?? '');setSubscriptionPlan(client.subscriptionPlan ?? 'DISCOVERY');setSubscriptionStatus(client.subscriptionStatus ?? 'PROSPECT');setPaymentStatus(client.paymentStatus ?? 'UNPAID');setSubscriptionEndsAt(client.subscriptionEndsAt ? client.subscriptionEndsAt.slice(0, 10) : '');setMessage('');setError('');window.scrollTo({top:0,behavior:'smooth'});}

  async function submitClient(event: FormEvent<HTMLFormElement>) {event.preventDefault();setSubmitting(true);setError('');setMessage('');try {const body = JSON.stringify({firstName:firstName.trim(),name:lastName.trim(),email:email.trim(),subscriptionPlan,subscriptionStatus,paymentStatus,...(subscriptionEndsAt ? { subscriptionEndsAt: `${subscriptionEndsAt}T23:59:59.000Z` } : {}),...(phone.trim() ? { phone: phone.trim() } : {}),...(companyName.trim() ? { companyName: companyName.trim() } : {}),...(notes.trim() ? { notes: notes.trim() } : {})});if (editingId) {await apiRequest<ClientItem>(`/clients/${editingId}`, { method: 'PATCH', body });setMessage('Client et abonnement mis à jour.');} else {await apiRequest<ClientItem>('/clients', { method: 'POST', body });setMessage('Client ajouté.');}resetForm();loadClients();} catch (caught) {setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');} finally {setSubmitting(false);}}
  async function removeClient(client: ClientItem) {const label = `${client.firstName ?? ''} ${client.lastName ?? client.name}`.trim();if (!canDelete || !window.confirm(`Supprimer définitivement le client « ${label} » ?`)) return;setSubmitting(true);setError('');setMessage('');try {await apiRequest<{ deleted: true }>(`/clients/${client.id}`, { method: 'DELETE' });if (editingId === client.id) resetForm();setMessage('Client supprimé.');loadClients();} catch (caught) {setError(caught instanceof Error ? caught.message : 'Suppression impossible');} finally {setSubmitting(false);}}

  return <PortalShell>
    <div className="header"><div><h1>Clients</h1><p>Identité, abonnement, paiement et progression commerciale dans une seule fiche.</p></div></div>
    {error ? <p className="error">{error}</p> : null}{message ? <p className="success">{message}</p> : null}
    <div className="grid client-grid">
      <section className="card client-editor-card">
        <h2 style={{ marginTop: 0 }}>{editingId ? 'Modifier le client' : 'Nouveau client'}</h2>
        <form className="form" onSubmit={submitClient}>
          <div className="field"><label htmlFor="lastName">Nom *</label><input id="lastName" required maxLength={160} value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          <div className="field"><label htmlFor="firstName">Prénom *</label><input id="firstName" required maxLength={160} value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
          <div className="field"><label htmlFor="email">E-mail *</label><input id="email" required type="email" maxLength={320} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field"><label htmlFor="company">Entreprise</label><input id="company" maxLength={160} value={companyName} onChange={(e) => setCompanyName(e.target.value)} /></div>
          <div className="field"><label htmlFor="phone">Téléphone</label><input id="phone" maxLength={40} value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
          <div className="subscription-editor"><div><div className="eyebrow">ABONNEMENT KHE BOOTH</div><h3 style={{ margin: '5px 0 4px' }}>{subscriptionPlanLabel(subscriptionPlan)}</h3><p className="muted" style={{ margin: 0, fontSize: 13 }}>Même catalogue que le site promotionnel public.</p></div><div className="field"><label htmlFor="subscriptionPlan">Niveau d’abonnement</label><select id="subscriptionPlan" value={subscriptionPlan} onChange={(e) => setSubscriptionPlan(e.target.value as SubscriptionPlan)}>{SUBSCRIPTION_CATALOG.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}{plan.priceMonthlyChf === null ? ' · Sur mesure' : ` · CHF ${plan.priceMonthlyChf}/mois`}</option>)}</select></div><div className="field"><label htmlFor="subscriptionStatus">Niveau d’action / parcours</label><select id="subscriptionStatus" value={subscriptionStatus} onChange={(e) => setSubscriptionStatus(e.target.value as SubscriptionStatus)}>{SUBSCRIPTION_STATUSES.map((status) => <option key={status} value={status}>{subscriptionStatusLabels[status]}</option>)}</select></div><div className="field"><label htmlFor="paymentStatus">Paiement</label><select id="paymentStatus" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{paymentStatusLabels[status]}</option>)}</select></div><div className="field"><label htmlFor="subscriptionEndsAt">Fin d’abonnement éventuelle</label><input id="subscriptionEndsAt" type="date" value={subscriptionEndsAt} onChange={(e) => setSubscriptionEndsAt(e.target.value)} /></div></div>
          <div className="field"><label htmlFor="notes">Notes</label><textarea id="notes" rows={4} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <p className="muted" style={{ fontSize: 12 }}>* Nom, prénom et e-mail sont obligatoires. Un paiement marqué « Payé » active automatiquement l’abonnement sauf suspension/résiliation explicite.</p>
          <div className="toolbar"><button className="button" disabled={submitting}>{submitting ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Ajouter le client'}</button>{editingId ? <button className="button secondary" type="button" onClick={resetForm}>Annuler</button> : null}</div>
        </form>
      </section>

      <section className="card client-table-card">
        <div className="client-list-heading"><div><div className="eyebrow">PORTEFEUILLE CLIENT</div><h2>Suivi des clients</h2></div><span>{clients.length} client{clients.length>1?'s':''}</span></div>
        {clients.length === 0 ? <div className="empty">Aucun client.</div> : <>
          <div className="client-desktop-table"><table className="table"><thead><tr><th>Client</th><th>E-mail</th><th>Abonnement</th><th>Niveau d’action</th><th>Paiement</th><th>Actions</th></tr></thead><tbody>{clients.map((client) => {const plan = client.subscriptionPlan ?? 'DISCOVERY';const status = client.subscriptionStatus ?? 'PROSPECT';const payment = client.paymentStatus ?? 'UNPAID';return <tr key={client.id}><td><button className="link-button" type="button" onClick={() => editClient(client)}>{client.firstName ? `${client.firstName} ${client.lastName ?? ''}`.trim() : client.name}</button>{client.companyName ? <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{client.companyName}</div> : null}</td><td>{client.email ?? 'À compléter'}</td><td><span className={`subscription-pill subscription-${plan.toLowerCase()}`}>{subscriptionPlanLabel(plan)}</span></td><td><span className={`journey-pill journey-${status.toLowerCase()}`}>{subscriptionStatusLabels[status]}</span></td><td><span className={`payment-pill payment-${payment.toLowerCase()}`}>{paymentStatusLabels[payment]}</span></td><td><div className="client-action-row"><button className="button secondary compact" type="button" onClick={() => editClient(client)}>Modifier</button>{canDelete ? <button className="button danger compact" type="button" disabled={submitting} onClick={() => void removeClient(client)}>Supprimer</button> : null}</div></td></tr>;})}</tbody></table></div>
          <div className="client-mobile-list">{clients.map((client)=>{const plan=client.subscriptionPlan??'DISCOVERY';const status=client.subscriptionStatus??'PROSPECT';const payment=client.paymentStatus??'UNPAID';return <article className="client-mobile-card" key={client.id}><div className="client-mobile-top"><div><button className="link-button client-name-button" type="button" onClick={()=>editClient(client)}>{client.firstName?`${client.firstName} ${client.lastName??''}`.trim():client.name}</button>{client.companyName?<div className="muted client-company">{client.companyName}</div>:null}</div><span className={`payment-pill payment-${payment.toLowerCase()}`}>{paymentStatusLabels[payment]}</span></div><div className="client-contact">{client.email??'E-mail à compléter'}{client.phone?<span>{client.phone}</span>:null}</div><div className="client-status-grid"><div><small>ABONNEMENT</small><span className={`subscription-pill subscription-${plan.toLowerCase()}`}>{subscriptionPlanLabel(plan)}</span></div><div><small>PARCOURS</small><span className={`journey-pill journey-${status.toLowerCase()}`}>{subscriptionStatusLabels[status]}</span></div><div><small>PAIEMENT</small><span className={`payment-pill payment-${payment.toLowerCase()}`}>{paymentStatusLabels[payment]}</span></div></div><div className="client-mobile-actions"><button className="button secondary" type="button" onClick={()=>editClient(client)}>Modifier</button>{canDelete?<button className="button danger" type="button" disabled={submitting} onClick={()=>void removeClient(client)}>Supprimer</button>:null}</div></article>})}</div>
        </>}
      </section>
    </div>
  </PortalShell>;
}
