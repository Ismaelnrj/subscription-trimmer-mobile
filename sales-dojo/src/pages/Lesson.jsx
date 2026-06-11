import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { getModule, getLesson } from '../data/curriculum.js';
import { isLessonComplete, markLessonComplete } from '../lib/storage.js';

export default function Lesson() {
  const { moduleId, lessonId } = useParams();
  const navigate = useNavigate();
  const mod = getModule(moduleId);
  const lesson = mod && getLesson(moduleId, lessonId);

  if (!mod || !lesson) return <Navigate to="/" replace />;

  const lessonIndex = mod.lessons.findIndex((l) => l.id === lessonId);
  const prevLesson = mod.lessons[lessonIndex - 1];
  const nextLesson = mod.lessons[lessonIndex + 1];
  const completed = isLessonComplete(lesson.id);

  function handleComplete() {
    markLessonComplete(lesson.id);
    if (nextLesson) {
      navigate(`/module/${mod.id}/lesson/${nextLesson.id}`);
    } else {
      navigate(`/module/${mod.id}/quiz`);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <Link to={`/module/${mod.id}`} style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          ← {mod.title}
        </Link>
      </div>
      <h1 className="page-title">{lesson.title}</h1>
      <p className="page-subtitle">
        Lesson {lessonIndex + 1} of {mod.lessons.length}
        {completed ? ' · ✅ Completed' : ''}
      </p>

      <div className="card">
        {lesson.sections.map((section, i) => (
          <div className="lesson-section" key={i}>
            {section.heading && <h3>{section.heading}</h3>}
            {section.body && <p>{section.body}</p>}
            {section.list && (
              <ul>
                {section.list.map((item, j) => (
                  <li key={j}>{item}</li>
                ))}
              </ul>
            )}
            {section.tip && <div className="lesson-tip">💡 {section.tip}</div>}
          </div>
        ))}
      </div>

      <div className="lesson-nav">
        {prevLesson ? (
          <Link to={`/module/${mod.id}/lesson/${prevLesson.id}`} className="btn btn-secondary">
            ← Previous
          </Link>
        ) : (
          <span />
        )}
        <button className="btn btn-primary" onClick={handleComplete}>
          {completed ? 'Mark complete & continue' : 'Mark as complete'} →
        </button>
      </div>
    </div>
  );
}
