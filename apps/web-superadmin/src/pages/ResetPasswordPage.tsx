import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/Button';
import { TextField } from '../components/FormFields';
import { ErrorBanner } from '../components/Feedback';
import { api, ApiError } from '../lib/api-client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/password/reset', { token, newPassword }, { skipAuth: true });
      navigate('/login', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo restablecer la contraseña.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthCard title="Enlace invalido">
        <ErrorBanner message="Este enlace no incluye un token de restablecimiento." />
        <Link
          to="/forgot-password"
          className="text-center text-caption font-medium text-electric-blue hover:underline"
        >
          Solicitar uno nuevo
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Restablecer contraseña">
      <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Nueva contraseña"
          name="newPassword"
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Guardar y continuar'}
        </Button>
      </form>
    </AuthCard>
  );
}
