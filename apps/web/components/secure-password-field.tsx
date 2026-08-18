'use client';

import { useId, useMemo, useState } from 'react';

type SecurePasswordFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  name?: string;
};

export function SecurePasswordField({ label, value, onChange, autoComplete = 'current-password', required = false, name }: SecurePasswordFieldProps) {
  const generatedId = useId();
  const id = name ?? generatedId;
  const [visible, setVisible] = useState(false);
  const stars = useMemo(() => '★'.repeat(Math.min(value.length, 28)), [value]);

  return (
    <div className="field secure-password-field">
      <label htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ paddingRight: 52, width: '100%' }}
        />
        <button
          type="button"
          aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 0, background: 'transparent', cursor: 'pointer', fontSize: 18, padding: 7 }}
        >
          {visible ? '🙈' : '👁'}
        </button>
      </div>
      <div aria-live="polite" style={{ minHeight: 18, marginTop: 5, fontSize: 12, letterSpacing: 2, opacity: 0.62, wordBreak: 'break-all' }}>
        {value.length === 0 ? 'Saisie sécurisée' : visible ? 'Mot de passe visible' : stars}
      </div>
    </div>
  );
}
