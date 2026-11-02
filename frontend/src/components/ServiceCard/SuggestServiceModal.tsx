import { useState } from 'react';
import { X } from 'lucide-react';
import { suggestService } from '../../services/api';

interface SuggestServiceModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function SuggestServiceModal({ onClose, onSuccess }: SuggestServiceModalProps) {
  const [form, setForm] = useState({
    name: '',
    type: '',
    formatted_address: '',
    phone: '',
    website: '',
    opening_hours: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update<K extends keyof typeof form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError('');
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Service name is required.');
      return;
    }
    setSubmitting(true);
    try {
      await suggestService({
        name: form.name.trim(),
        type: form.type.trim() || undefined,
        formatted_address: form.formatted_address.trim() || undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        opening_hours: form.opening_hours.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit your suggestion.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="suggest-overlay" onClick={onClose}>
      <div
        className="suggest-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-title"
      >
        <button className="suggest-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <h2 id="suggest-title">Suggest a Service</h2>
        <p className="suggest-hint">
          An admin will review your suggestion before it appears on the map.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {error && <p className="form-error" role="alert">{error}</p>}

          <label className="field-label" htmlFor="suggest-name">Service name *</label>
          <input
            id="suggest-name"
            className="auth-input"
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            placeholder="e.g. Woodstock Community Clinic"
            required
          />

          <label className="field-label" htmlFor="suggest-type">Category</label>
          <input
            id="suggest-type"
            className="auth-input"
            value={form.type}
            onChange={(event) => update('type', event.target.value)}
            placeholder="Clinic, Library, Police station…"
          />

          <label className="field-label" htmlFor="suggest-address">Address</label>
          <input
            id="suggest-address"
            className="auth-input"
            value={form.formatted_address}
            onChange={(event) => update('formatted_address', event.target.value)}
            placeholder="Street, suburb, city"
          />

          <label className="field-label" htmlFor="suggest-phone">Phone</label>
          <input
            id="suggest-phone"
            className="auth-input"
            value={form.phone}
            onChange={(event) => update('phone', event.target.value)}
            placeholder="Phone number"
          />

          <label className="field-label" htmlFor="suggest-website">Website</label>
          <input
            id="suggest-website"
            className="auth-input"
            value={form.website}
            onChange={(event) => update('website', event.target.value)}
            placeholder="https://…"
          />

          <label className="field-label" htmlFor="suggest-hours">Opening hours</label>
          <input
            id="suggest-hours"
            className="auth-input"
            value={form.opening_hours}
            onChange={(event) => update('opening_hours', event.target.value)}
            placeholder="Mon–Fri 08:00–16:00"
          />

          <button className="submit-button" type="submit" disabled={submitting}>
            {submitting ? 'Submitting…' : <>Submit Suggestion <span aria-hidden="true">→</span></>}
          </button>
        </form>
      </div>
    </div>
  );
}