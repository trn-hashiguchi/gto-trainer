import { NavLink, Route, Routes } from 'react-router-dom';
import ReferencePage from './pages/ReferencePage';
import DrillPage from './pages/DrillPage';
import StatsPage from './pages/StatsPage';

const NAV_ITEMS = [
  { to: '/', label: 'ドリル', icon: '🎯', end: true },
  { to: '/reference', label: 'レンジ', icon: '📊', end: false },
  { to: '/stats', label: '統計', icon: '📈', end: false },
] as const;

export default function App() {
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-700 px-3 py-2 sm:px-4 sm:py-3 flex items-center gap-3 sm:gap-6 sticky top-0 bg-slate-900/95 backdrop-blur z-20">
        <h1 className="font-bold text-base sm:text-lg whitespace-nowrap">Poker GTO</h1>
        {/* デスクトップ用ナビ（モバイルは下部ナビへ） */}
        <nav className="hidden sm:flex gap-4 text-sm">
          {NAV_ITEMS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => (isActive ? 'text-emerald-400' : 'text-slate-300 hover:text-slate-100')}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 px-3 py-3 sm:p-4 pb-safe-nav">
        <Routes>
          <Route path="/" element={<DrillPage />} />
          <Route path="/reference" element={<ReferencePage />} />
          <Route path="/stats" element={<StatsPage />} />
        </Routes>
      </main>

      {/* モバイル用ボトムタブ */}
      <nav
        className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="grid grid-cols-3">
          {NAV_ITEMS.map((n) => (
            <li key={n.to}>
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 text-[11px] gap-0.5 ${
                    isActive ? 'text-emerald-400' : 'text-slate-400'
                  }`
                }
              >
                <span className="text-lg leading-none">{n.icon}</span>
                <span>{n.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
