import { useState, useRef, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { SCENARIOS, getScenario } from '../data/scenarios.js';
import { MODULES } from '../data/curriculum.js';
import { getRoleplayReply, getCoachingFeedback, MissingApiKeyError } from '../lib/anthropic.js';
import { saveRoleplayResult, getApiKey } from '../lib/storage.js';

export default function Roleplay() {
  const location = useLocation();
  const [scenarioId, setScenarioId] = useState(location.state?.scenarioId || null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [error, setError] = useState(null);
  const chatEndRef = useRef(null);

  const scenario = scenarioId ? getScenario(scenarioId) : null;
  const hasApiKey = !!getApiKey();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, feedback]);

  function selectScenario(id) {
    setScenarioId(id);
    const sc = getScenario(id);
    setMessages([{ role: 'assistant', content: sc.openingLine }]);
    setFeedback(null);
    setError(null);
    setInput('');
  }

  function backToScenarios() {
    setScenarioId(null);
    setMessages([]);
    setFeedback(null);
    setError(null);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    const newMessages = [...messages, { role: 'user', content: text }];
    setMessages(newMessages);
    setInput('');
    setError(null);
    setLoading(true);
    try {
      const reply = await getRoleplayReply(scenario, newMessages);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? err.message : `Something went wrong: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGetFeedback() {
    setFeedbackLoading(true);
    setError(null);
    try {
      const fb = await getCoachingFeedback(scenario, messages);
      setFeedback(fb);
      saveRoleplayResult(scenario.id, fb);
    } catch (err) {
      setError(err instanceof MissingApiKeyError ? err.message : `Something went wrong: ${err.message}`);
    } finally {
      setFeedbackLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!scenario) {
    return (
      <div>
        <h1 className="page-title">AI Roleplay</h1>
        <p className="page-subtitle">
          Practice real conversations with an AI playing the prospect. Pick a scenario to start.
        </p>

        {!hasApiKey && (
          <div className="alert alert-error">
            You need an Anthropic API key to use the roleplay simulator.{' '}
            <Link to="/settings" style={{ fontWeight: 700, textDecoration: 'underline' }}>
              Add it in Settings
            </Link>
            .
          </div>
        )}

        {MODULES.map((mod) => {
          const scenarios = SCENARIOS.filter((s) => s.moduleId === mod.id);
          if (scenarios.length === 0) return null;
          return (
            <div key={mod.id} style={{ marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>
                {mod.icon} {mod.title}
              </h2>
              <div className="grid grid-2">
                {scenarios.map((s) => (
                  <div
                    key={s.id}
                    className="card scenario-card"
                    style={{ '--module-color': mod.color }}
                    onClick={() => selectScenario(s.id)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong>{s.title}</strong>
                      <span className="badge">{s.difficulty}</span>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={backToScenarios} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.88rem', cursor: 'pointer', padding: 0 }}>
          ← All scenarios
        </button>
      </div>
      <h1 className="page-title">{scenario.title}</h1>
      <p className="page-subtitle">
        <strong>Your goal:</strong> {scenario.yourGoal}
      </p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`chat-message ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-message assistant">…</div>}
        <div ref={chatEndRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          placeholder="Type your response..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading || !!feedback}
        />
        <button className="btn btn-primary" onClick={handleSend} disabled={loading || !!feedback || !input.trim()}>
          Send
        </button>
      </div>

      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-secondary"
          onClick={handleGetFeedback}
          disabled={feedbackLoading || !!feedback || messages.filter((m) => m.role === 'user').length === 0}
        >
          {feedbackLoading ? 'Analyzing…' : 'End & Get Feedback'}
        </button>
      </div>

      {feedback && (
        <div className="feedback-box">
          <strong>📋 Coaching Feedback</strong>
          <div style={{ marginTop: 8 }}>{feedback}</div>
          <div style={{ marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => selectScenario(scenario.id)}>
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
