import { useState } from 'react';
import { getApiKey, setApiKey, getModel, setModel, MODEL_OPTIONS } from '../lib/storage.js';
import { testApiKey } from '../lib/anthropic.js';

export default function Settings() {
  const [apiKey, setApiKeyInput] = useState(getApiKey());
  const [model, setModelInput] = useState(getModel());
  const [status, setStatus] = useState(null);
  const [testing, setTesting] = useState(false);

  function handleSave() {
    setApiKey(apiKey.trim());
    setModel(model);
    setStatus({ type: 'success', message: 'Settings saved.' });
  }

  async function handleTest() {
    setApiKey(apiKey.trim());
    setModel(model);
    setTesting(true);
    setStatus(null);
    try {
      await testApiKey();
      setStatus({ type: 'success', message: 'Connection successful! Your API key works.' });
    } catch (err) {
      setStatus({ type: 'error', message: `Connection failed: ${err.message}` });
    } finally {
      setTesting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      <p className="page-subtitle">
        Sales Dojo uses the Anthropic API to power the AI roleplay simulator. Your key is stored only in this
        browser's local storage — it is never sent anywhere except directly to Anthropic.
      </p>

      <div className="card" style={{ maxWidth: 520 }}>
        {status && <div className={`alert alert-${status.type}`}>{status.message}</div>}

        <div className="form-group">
          <label htmlFor="api-key">Anthropic API Key</label>
          <input
            id="api-key"
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKeyInput(e.target.value)}
            autoComplete="off"
          />
          <div className="form-hint">
            Get a key from{' '}
            <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
              console.anthropic.com
            </a>
            .
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="model">Model</label>
          <select id="model" value={model} onChange={(e) => setModelInput(e.target.value)}>
            {MODEL_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="btn btn-secondary" onClick={handleTest} disabled={!apiKey.trim() || testing}>
            {testing ? 'Testing…' : 'Test Connection'}
          </button>
        </div>
      </div>
    </div>
  );
}
