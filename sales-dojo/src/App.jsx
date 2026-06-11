import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Module from './pages/Module.jsx';
import Lesson from './pages/Lesson.jsx';
import Quiz from './pages/Quiz.jsx';
import Flashcards from './pages/Flashcards.jsx';
import Roleplay from './pages/Roleplay.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/module/:moduleId" element={<Module />} />
        <Route path="/module/:moduleId/lesson/:lessonId" element={<Lesson />} />
        <Route path="/module/:moduleId/quiz" element={<Quiz />} />
        <Route path="/flashcards" element={<Flashcards />} />
        <Route path="/roleplay" element={<Roleplay />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}
