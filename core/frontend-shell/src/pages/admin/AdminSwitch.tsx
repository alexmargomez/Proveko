import React from 'react';

export const AdminSwitch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  tone?: 'primary' | 'emerald' | 'amber';
}> = ({ checked, onChange, disabled = false, label, tone = 'primary' }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className="pk-switch-btn"
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
    >
      <span className={`pk-switch-track ${checked ? `on ${tone !== 'primary' ? tone : ''}` : ''}`}>
        <span className="pk-switch-thumb" />
      </span>
      {label && <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--pk-text)' }}>{label}</span>}
    </button>
  );
};
