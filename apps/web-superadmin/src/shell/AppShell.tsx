import { NavLink, Outlet } from 'react-router';
import { NAV_ITEMS } from './nav-items';
import { useAuth } from '../lib/auth-context';

export function AppShell() {
  const { user, hasCapability, logout } = useAuth();
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.capability || hasCapability(item.capability),
  );

  return (
    <div className="flex min-h-screen bg-canvas-white">
      <aside
        className="flex shrink-0 flex-col gap-8 border-r border-ash bg-canvas-white p-16"
        style={{ width: 'var(--sidebar-width)' }}
      >
        <span className="px-8 text-body-lg font-medium text-charcoal">Superadmin</span>
        <nav className="flex flex-1 flex-col gap-4">
          {visibleItems.map((item) => (
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
        {user && (
          <div className="flex flex-col gap-8 border-t border-ash pt-16">
            <p className="truncate px-8 text-caption text-fog" title={user.email}>
              {user.email}
            </p>
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-lg px-8 py-8 text-left text-body text-charcoal hover:bg-paper-mist"
            >
              Cerrar sesion
            </button>
          </div>
        )}
      </aside>
      <main className="flex-1 overflow-x-hidden p-32">
        <Outlet />
      </main>
    </div>
  );
}
