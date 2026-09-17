import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { Button } from '../components/Button';
import { TextField } from '../components/FormFields';
import { ErrorBanner, InlineNotice } from '../components/Feedback';
import { ApiError } from '../lib/api-client';
import { useAuth } from '../lib/auth-context';

type Step =
  | { kind: 'password' }
  | { kind: 'mfa_enrollment'; provisioningUri: string; secret: string };

function extractTotpSecret(provisioningUri: string): string {
  try {
    return new URL(provisioningUri).searchParams.get('secret') ?? '';
  } catch {
    return '';
  }
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const { acceptInvitation, verifyMfa } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!token) {
    return (
      <AuthCard title="Enlace invalido">
        <ErrorBanner message="Este enlace de invitacion no incluye un token." />
      </AuthCard>
    );
  }

  async function handlePasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await acceptInvitation(token!, password);
      if (result.kind === 'mfa_enrollment') {
        setStep({
          kind: 'mfa_enrollment',
          provisioningUri: result.provisioningUri,
          secret: extractTotpSecret(result.provisioningUri),
        });
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo aceptar la invitacion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleMfaSubmit(event: FormEvent) {
    event.preventDefault();
    const challengeToken = sessionStorage.getItem('sa_enrollment_challenge');
    if (!challengeToken) {
      setError('El enlace de verificacion expiro. Vuelve a intentar la invitacion.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await verifyMfa(challengeToken, code);
      sessionStorage.removeItem('sa_enrollment_challenge');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Codigo invalido.');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step.kind === 'mfa_enrollment') {
    return (
      <AuthCard
        title="Configura la verificacion en dos pasos"
        subtitle="Tu rol requiere un segundo factor (TOTP) antes de continuar."
      >
        <InlineNotice message="Agrega esta clave a tu app de autenticacion (Google Authenticator, Authy, 1Password, etc.) como cuenta nueva, ingresandola manualmente." />
        <div className="rounded-xl border border-ash bg-paper-mist px-16 py-12 text-center">
          <p className="text-caption text-fog">Clave secreta</p>
          <p className="mt-4 break-all font-mono text-body-lg text-charcoal">{step.secret}</p>
        </div>
        <form className="flex flex-col gap-16" onSubmit={handleMfaSubmit}>
          {error && <ErrorBanner message={error} />}
          <TextField
            label="Codigo de 6 digitos"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Verificando…' : 'Verificar y entrar'}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Activa tu cuenta"
      subtitle="Crea una contraseña para completar tu invitacion."
    >
      <form className="flex flex-col gap-16" onSubmit={handlePasswordSubmit}>
        {error && <ErrorBanner message={error} />}
        <TextField
          label="Contraseña"
          name="password"
          type="password"
          minLength={12}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Activando…' : 'Activar cuenta'}
        </Button>
      </form>
    </AuthCard>
  );
}
