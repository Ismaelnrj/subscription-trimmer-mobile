import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { getModule } from '../data/curriculum.js';
import { saveQuizScore } from '../lib/storage.js';

export default function Quiz() {
  const { moduleId } = useParams();
  const mod = getModule(moduleId);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  if (!mod) return <Navigate to="/" replace />;

  const questions = mod.quiz;
  const question = questions[current];

  function handleSelect(optionIndex) {
    if (selected !== null) return;
    setSelected(optionIndex);
    if (optionIndex === question.correct) {
      setScore((s) => s + 1);
    }
  }

  function handleNext() {
    if (current + 1 < questions.length) {
      setCurrent((c) => c + 1);
      setSelected(null);
    } else {
      saveQuizScore(mod.id, score, questions.length);
      setFinished(true);
    }
  }

  function handleRestart() {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div>
        <h1 className="page-title">{mod.title} Quiz</h1>
        <div className="card quiz-result">
          <div className="score">
            {score}/{questions.length}
          </div>
          <p style={{ color: 'var(--text-muted)' }}>{pct}% correct</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 20 }}>
            <button className="btn btn-secondary" onClick={handleRestart}>
              Retake Quiz
            </button>
            <Link to={`/module/${mod.id}`} className="btn btn-primary">
              Back to Module
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to={`/module/${mod.id}`} style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          ← {mod.title}
        </Link>
      </div>
      <h1 className="page-title">{mod.title} Quiz</h1>
      <p className="page-subtitle">
        Question {current + 1} of {questions.length}
      </p>

      <div className="card">
        <div className="quiz-question">
          <h3>{question.question}</h3>
          {question.options.map((option, i) => {
            let className = 'quiz-option';
            if (selected !== null) {
              if (i === question.correct) className += ' correct';
              else if (i === selected) className += ' incorrect';
            }
            return (
              <button key={i} className={className} onClick={() => handleSelect(i)} disabled={selected !== null}>
                {option}
              </button>
            );
          })}
          {selected !== null && <div className="quiz-explanation">{question.explanation}</div>}
        </div>

        <button className="btn btn-primary btn-block" onClick={handleNext} disabled={selected === null}>
          {current + 1 < questions.length ? 'Next Question' : 'See Results'}
        </button>
      </div>
    </div>
  );
}
