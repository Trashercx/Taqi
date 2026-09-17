import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { AuthProvider } from './lib/auth-context';
import { NAV_ITEMS } from './shell/nav-items';
import { CAPABILITIES } from './lib/capabilities';

/**
 * decodeJwt no verifica firma (ver lib/jwt.ts): para pruebas de UI basta un
 * token bien formado, sin importar que la firma no sea real.
 */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

function seedAuthenticatedSession() {
  const token = fakeJwt({
    sub: 'user-1',
    email: 'owner@example.com',
    roles: ['platform_owner'],
    capabilities: [...CAPABILITIES],
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  localStorage.setItem('sa_access_token', token);
  localStorage.setItem('sa_refresh_token', 'refresh-token-fake');
}

function renderApp() {
  return render(
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects an unauthenticated visitor to the login page', async () => {
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Iniciar sesion' })).toBeInTheDocument();
  });

  it('shows the shell with every approved navigation item once authenticated', async () => {
    seedAuthenticatedSession();
    renderApp();

    expect(await screen.findByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
  });
});
