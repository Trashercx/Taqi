import { NavLink, Outlet } from 'react-router';
import { NAV_ITEMS } from './nav-items';

export function AppShell() {
  return (
    <div className="flex min-h-screen bg-canvas-white">
      <aside
        className="flex shrink-0 flex-col gap-8 border-r border-ash bg-canvas-white p-16"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <span className="px-8 text-body-lg font-medium text-charcoal">Superadmin</span>
        <nav className="flex flex-col gap-4">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                [
                  'rounded-lg px-8 py-12 text-body text-charcoal transition-colors',
                  isActive ? 'bg-[#dbeaff]' : 'hover:bg-paper-mist',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-32">
        <Outlet />
      </main>
    </div>
  );
}
