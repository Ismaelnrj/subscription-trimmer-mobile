import { useState, useMemo } from 'react';
import { MODULES } from '../data/curriculum.js';
import { getDueCards, reviewCard, getFlashcardStats } from '../lib/storage.js';

export default function Flashcards() {
  const [moduleFilter, setModuleFilter] = useState('all');
  const [sessionKey, setSessionKey] = useState(0);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [reviewed, setReviewed] = useState(0);

  const cards = useMemo(() => {
    return getDueCards(moduleFilter === 'all' ? null : moduleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleFilter, sessionKey]);

  const stats = useMemo(() => getFlashcardStats(), [sessionKey]);

  const card = cards[index];
  const mod = card && MODULES.find((m) => m.id === card.moduleId);

  function handleAnswer(knewIt) {
    reviewCard(card.id, knewIt);
    setReviewed((r) => r + 1);
    setFlipped(false);
    if (index + 1 < cards.length) {
      setIndex((i) => i + 1);
    } else {
      setIndex(cards.length); // move past the end -> session complete
    }
  }

  function handleRestart() {
    setSessionKey((k) => k + 1);
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
  }

  function handleFilterChange(value) {
    setModuleFilter(value);
    setIndex(0);
    setFlipped(false);
    setReviewed(0);
  }

  return (
    <div>
      <h1 className="page-title">Flashcards</h1>
      <p className="page-subtitle">Spaced repetition (Leitner system) — cards you know move to longer review intervals.</p>

      <div className="form-group" style={{ maxWidth: 320 }}>
        <label>Module</label>
        <select value={moduleFilter} onChange={(e) => handleFilterChange(e.target.value)}>
          <option value="all">All modules ({stats.due} due)</option>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>
              {m.icon} {m.title}
            </option>
          ))}
        </select>
      </div>

      {!card ? (
        <div className="card empty-state">
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
          <p>
            {reviewed > 0
              ? `Nice work — you reviewed ${reviewed} card${reviewed === 1 ? '' : 's'}.`
              : 'No flashcards are due right now. Come back later!'}
          </p>
          {reviewed > 0 && (
            <button className="btn btn-secondary" onClick={handleRestart} style={{ marginTop: 12 }}>
              Check again
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="flashcard-meta">
            <span>
              {mod?.icon} {mod?.title}
            </span>
            <span>
              Card {index + 1} of {cards.length}
            </span>
          </div>

          <div className="card flashcard-wrapper" onClick={() => setFlipped((f) => !f)}>
            <span className="flashcard-side-label">{flipped ? 'Answer' : 'Question'}</span>
            <div className="flashcard">{flipped ? card.back : card.front}</div>
          </div>

          {!flipped ? (
            <button className="btn btn-primary btn-block" style={{ marginTop: 16 }} onClick={() => setFlipped(true)}>
              Show Answer
            </button>
          ) : (
            <div className="flashcard-actions">
              <button className="btn btn-secondary" onClick={() => handleAnswer(false)}>
                😅 Still learning
              </button>
              <button className="btn btn-primary" onClick={() => handleAnswer(true)}>
                ✅ I knew it
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
