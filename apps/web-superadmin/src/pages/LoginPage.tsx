import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/Button';
import { TextField } from '../components/FormFields';
import { ErrorBanner } from '../components/Feedback';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type Step = { kind: 'credentials' } | { kind: 'mfa'; challengeToken: string };

export function LoginPage() {
  const { user, login, verifyMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>({ kind: 'credentials' });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user) {
    const from = (location.state as { from?: { pathname: string; search: string } } | null)
      ?.from;
    const redirectTo = from ? `${from.pathname}${from.search}` : '/';
    return <Navigate to={redirectTo} replace />;
  }

  async function handleCredentialsSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.kind === 'mfa_required') {
        setStep({ kind: 'mfa', challengeToken: result.challengeToken });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo iniciar sesion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();
    if (step.kind !== 'mfa') return;
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfa(step.challengeToken, code);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Codigo invalido.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step.kind === 'mfa') {
    return (
      <AuthCard
        title="Verificacion en dos pasos"
        subtitle="Ingresa el codigo de tu app de autenticacion."
      >
        <form className="flex flex-col gap-16" onSubmit={handleMfaSubmit}>
          {error && <ErrorBanner message={error} />}
          <TextField
            label="Codigo"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Verificando…' : 'Verificar'}
          </Button>
          <button
            type="button"
            className="text-caption text-fog hover:text-charcoal"
            onClick={() => {
              setStep({ kind: 'credentials' });
              setCode('');
              setError(null);
            }}
          >
            Volver
          </button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Iniciar sesion" subtitle="Acceso exclusivo para el equipo de la plataforma.">
      <form className="flex flex-col gap-16" onSubmit={handleCredentialsSubmit}>
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Correo"
          name="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Ingresando…' : 'Ingresar'}
        </Button>
        <Link to="/forgot-password" className="text-center text-caption text-fog hover:text-charcoal">
          Olvide mi contraseña
        </Link>
      </form>
    </AuthCard>
  );
}
