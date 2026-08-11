'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { PortalShell } from '@/components/portal-shell';
import { apiRequest, getSessionUser } from '@/lib/api';

type PresetItem = {
  id: string;
  name: string;
  aspectRatio: 'PORTRAIT_9_16' | 'SQUARE_1_1';
  configuration: Record<string, unknown>;
};

export default function PresetsPage() {
  const [presets, setPresets] = useState<PresetItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [aspectRatio, setAspectRatio] = useState<PresetItem['aspectRatio']>('PORTRAIT_9_16');
  const [configuration, setConfiguration] = useState('{}');
  const [canDelete, setCanDelete] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPresets = useCallback(() => {
    apiRequest<PresetItem[]>('/presets')
      .then(setPresets)
      .catch((caught) => setError(caught instanceof Error ? caught.message : 'Chargement impossible'));
  }, []);

  useEffect(() => {
    const role = getSessionUser()?.role;
    setCanDelete(role === 'OWNER' || role === 'ADMIN');
    loadPresets();
  }, [loadPresets]);

  function resetForm() {
    setEditingId(null);
    setName('');
    setAspectRatio('PORTRAIT_9_16');
    setConfiguration('{}');
  }

  function editPreset(preset: PresetItem) {
    setEditingId(preset.id);
    setName(preset.name);
    setAspectRatio(preset.aspectRatio);
    setConfiguration(JSON.stringify(preset.configuration ?? {}, null, 2));
    setError('');
    setMessage('');
  }

  async function submitPreset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');

    let parsedConfiguration: Record<string, unknown>;
    try {
      const parsed = JSON.parse(configuration) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
        throw new Error('La configuration doit être un objet JSON.');
      }
      parsedConfiguration = parsed as Record<string, unknown>;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Configuration JSON invalide');
      return;
    }

    setSubmitting(true);
    try {
      const body = JSON.stringify({ name, aspectRatio, configuration: parsedConfiguration });
      if (editingId) {
        await apiRequest<PresetItem>(`/presets/${editingId}`, { method: 'PATCH', body });
        setMessage('Preset mis à jour.');
      } else {
        await apiRequest<PresetItem>('/presets', { method: 'POST', body });
        setMessage('Preset créé.');
      }
      resetForm();
      loadPresets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Enregistrement impossible');
    } finally {
      setSubmitting(false);
    }
  }

  async function removePreset(preset: PresetItem) {
    if (!canDelete || !window.confirm(`Supprimer définitivement le preset « ${preset.name} » ?`)) return;
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      await apiRequest<{ deleted: true }>(`/presets/${preset.id}`, { method: 'DELETE' });
      if (editingId === preset.id) resetForm();
      setMessage('Preset supprimé.');
      loadPresets();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Suppression impossible');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PortalShell>
      <div className="header">
        <div><h1>Presets</h1><p>Configurations de capture du MVP KHE Booth.</p></div>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <div className="grid client-grid">
        <section className="card">
          <h2 style={{ marginTop: 0 }}>{editingId ? 'Modifier le preset' : 'Nouveau preset'}</h2>
          <form className="form" onSubmit={submitPreset}>
            <div className="field"><label htmlFor="preset-name">Nom</label><input id="preset-name" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div className="field">
              <label htmlFor="aspect-ratio">Format</label>
              <select id="aspect-ratio" value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as PresetItem['aspectRatio'])}>
                <option value="PORTRAIT_9_16">9:16 · Portrait</option>
                <option value="SQUARE_1_1">1:1 · Carré</option>
              </select>
            </div>
            <div className="field"><label htmlFor="configuration">Configuration JSON</label><textarea id="configuration" className="code-input" rows={12} value={configuration} onChange={(e) => setConfiguration(e.target.value)} spellCheck={false} /></div>
            <div className="toolbar">
              <button className="button" disabled={submitting}>{submitting ? 'Enregistrement…' : editingId ? 'Enregistrer les modifications' : 'Créer le preset'}</button>
              {editingId ? <button className="button secondary" type="button" onClick={resetForm}>Annuler</button> : null}
            </div>
          </form>
        </section>

        <section className="card">
          {presets.length === 0 ? <div className="empty">Aucun preset. Créez d’abord une configuration 9:16 ou 1:1.</div> : (
            <table className="table">
              <thead><tr><th>Nom</th><th>Format</th><th>Configuration</th><th></th></tr></thead>
              <tbody>{presets.map((preset) => (
                <tr key={preset.id}>
                  <td><button className="link-button" type="button" onClick={() => editPreset(preset)}>{preset.name}</button></td>
                  <td>{preset.aspectRatio === 'PORTRAIT_9_16' ? '9:16' : '1:1'}</td>
                  <td><code>{JSON.stringify(preset.configuration)}</code></td>
                  <td><div className="toolbar"><button className="button secondary compact" type="button" onClick={() => editPreset(preset)}>Modifier</button>{canDelete ? <button className="button danger compact" type="button" disabled={submitting} onClick={() => void removePreset(preset)}>Supprimer</button> : null}</div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      </div>
    </PortalShell>
  );
}
