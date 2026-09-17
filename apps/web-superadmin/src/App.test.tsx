import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BrowserRouter } from 'react-router';
import { App } from './App';
import { NAV_ITEMS } from './shell/nav-items';

describe('App shell', () => {
  it('renders every approved navigation item', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole('link', { name: item.label })).toBeInTheDocument();
    }
  });

  it('shows the dashboard by default', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Resumen' })).toBeInTheDocument();
  });
});
