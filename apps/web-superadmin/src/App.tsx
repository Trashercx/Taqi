import { Route, Routes } from 'react-router';
import { AppShell } from './shell/AppShell';
import { NAV_ITEMS } from './shell/nav-items';
import { DashboardPage } from './pages/DashboardPage';
import { ComingSoonPage } from './pages/ComingSoonPage';

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        {NAV_ITEMS.filter((item) => item.path !== '/').map((item) => (
          <Route
            key={item.path}
            path={item.path.slice(1)}
            element={<ComingSoonPage title={item.label} />}
          />
        ))}
      </Route>
    </Routes>
  );
}
