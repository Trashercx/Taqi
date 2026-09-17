import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/Button';
import { TextField } from '../components/FormFields';
import { ErrorBanner, InlineNotice } from '../components/Feedback';
import { api, ApiError } from '../lib/api-client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await api.post('/auth/password/forgot', { email }, { skipAuth: true });
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo procesar la solicitud.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (sent) {
    return (
      <AuthCard title="Solicitud enviada">
        <InlineNotice message="Si el correo existe en la plataforma, se genero un token de restablecimiento. Como todavia no hay un proveedor de correo configurado, pidele a un Platform Owner que te lo comparta desde los registros del sistema." />
        <Link
          to="/login"
          className="text-center text-caption font-medium text-electric-blue hover:underline"
        >
          Volver a iniciar sesion
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Recuperar acceso"
      subtitle="Te ayudamos a generar un nuevo token de restablecimiento."
    >
      <form className="flex flex-col gap-16" onSubmit={handleSubmit}>
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
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Enviando…' : 'Enviar'}
        </Button>
        <Link to="/login" className="text-center text-caption text-fog hover:text-charcoal">
          Volver a iniciar sesion
        </Link>
      </form>
    </AuthCard>
  );
}
