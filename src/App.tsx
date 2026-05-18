import { NavLink, Route, Routes } from 'react-router-dom';
import ReferencePage from './pages/ReferencePage';
import DrillPage from './pages/DrillPage';
import StatsPage from './pages/StatsPage';

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-700 px-4 py-3 flex items-center gap-6">
        <h1 className="font-bold text-lg">Poker GTO Trainer</h1>
        <nav className="flex gap-4 text-sm">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'text-emerald-400' : '')}>
            ドリル
          </NavLink>
          <NavLink to="/reference" className={({ isActive }) => (isActive ? 'text-emerald-400' : '')}>
            レンジ参照
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => (isActive ? 'text-emerald-400' : '')}>
            統計
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 p-4">
        <Routes>
          <Route path="/" element={<DrillPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>
    </div>
  );
}
