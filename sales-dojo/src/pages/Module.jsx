import { useParams, Link, Navigate } from 'react-router-dom';
import { getModule } from '../data/curriculum.js';
import { getScenariosForModule } from '../data/scenarios.js';
import { isLessonComplete, getQuizScore } from '../lib/storage.js';
import ProgressBar from '../components/ProgressBar.jsx';

export default function Module() {
  const { moduleId } = useParams();
  const mod = getModule(moduleId);

  if (!mod) return <Navigate to="/" replace />;

  const lessonsDone = mod.lessons.filter((l) => isLessonComplete(l.id)).length;
  const quizScore = getQuizScore(mod.id);
  const scenarios = getScenariosForModule(mod.id);

  return (
    <div>
      <h1 className="page-title">
        {mod.icon} {mod.title}
      </h1>
      <p className="page-subtitle">{mod.summary}</p>

      <div className="card" style={{ marginBottom: 24, '--module-color': mod.color }}>
        <ProgressBar
          value={lessonsDone}
          max={mod.lessons.length}
          label={`${lessonsDone}/${mod.lessons.length} lessons completed`}
          color={mod.color}
        />
      </div>

      <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Lessons</h2>
      <div className="grid" style={{ marginBottom: 28 }}>
        {mod.lessons.map((lesson, i) => (
          <Link key={lesson.id} to={`/module/${mod.id}/lesson/${lesson.id}`} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700 }}>
                {i + 1}. {lesson.title}
              </div>
            </div>
            <span>{isLessonComplete(lesson.id) ? '✅' : '➡️'}</span>
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Quiz</h2>
      <div className="card" style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{mod.title} Quiz</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {quizScore ? `Last score: ${quizScore.score}/${quizScore.total}` : `${mod.quiz.length} questions`}
          </div>
        </div>
        <Link to={`/module/${mod.id}/quiz`} className="btn btn-primary">
          {quizScore ? 'Retake Quiz' : 'Start Quiz'}
        </Link>
      </div>

      {scenarios.length > 0 && (
        <>
          <h2 style={{ fontSize: '1.05rem', marginBottom: 12 }}>Practice with AI</h2>
          <div className="grid">
            {scenarios.map((s) => (
              <Link key={s.id} to="/roleplay" state={{ scenarioId: s.id }} className="card scenario-card" style={{ '--module-color': mod.color }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.title}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>{s.description}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
