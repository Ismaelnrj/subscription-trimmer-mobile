import { Link } from 'react-router-dom';
import { MODULES, totalLessonCount } from '../data/curriculum.js';
import { getCompletedLessons, getQuizScore, getFlashcardStats, getApiKey } from '../lib/storage.js';
import ProgressBar from '../components/ProgressBar.jsx';

export default function Dashboard() {
  const completed = getCompletedLessons();
  const totalLessons = totalLessonCount();
  const completedCount = Object.keys(completed).length;
  const flashcardStats = getFlashcardStats();
  const hasApiKey = !!getApiKey();

  return (
    <div>
      <h1 className="page-title">Welcome back 👋</h1>
      <p className="page-subtitle">
        Pick a module to learn, drill flashcards to lock it in, or jump into an AI roleplay to practice live.
      </p>

      {!hasApiKey && (
        <div className="alert alert-error">
          You haven't added an Anthropic API key yet — the AI Roleplay simulator needs one.{' '}
          <Link to="/settings" style={{ fontWeight: 700, textDecoration: 'underline' }}>
            Add it in Settings
          </Link>
          .
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 28 }}>
        <div className="card">
          <div className="progress-label">
            <span>Lessons completed</span>
            <span>
              {completedCount} / {totalLessons}
            </span>
          </div>
          <ProgressBar value={completedCount} max={totalLessons} />
        </div>
        <div className="card">
          <div className="progress-label">
            <span>Flashcards due for review</span>
            <span>
              {flashcardStats.due} / {flashcardStats.total}
            </span>
          </div>
          <ProgressBar value={flashcardStats.total - flashcardStats.due} max={flashcardStats.total} color="#059669" />
        </div>
      </div>

      <h2 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Modules</h2>
      <div className="grid grid-2">
        {MODULES.map((mod) => {
          const lessonsDone = mod.lessons.filter((l) => completed[l.id]).length;
          const quizScore = getQuizScore(mod.id);
          return (
            <Link key={mod.id} to={`/module/${mod.id}`} className="card module-card" style={{ '--module-color': mod.color }}>
              <div className="module-card-header">
                <span className="module-icon">{mod.icon}</span>
                <span>{mod.title}</span>
              </div>
              <p className="module-card-summary">{mod.summary}</p>
              <ProgressBar
                value={lessonsDone}
                max={mod.lessons.length}
                label={`${lessonsDone}/${mod.lessons.length} lessons`}
                color={mod.color}
              />
              {quizScore && (
                <div className="badge">
                  Quiz: {quizScore.score}/{quizScore.total}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
