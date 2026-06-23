import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { verifyHelloWithToken } from '@/api/verifyHelloWithToken';
import { saveAuthToken } from '@/lib/authToken';
import { setAuthLoginRequired } from '@/lib/authSession';
import { useReloadAppConfig } from '@/hooks/userConfig/useReloadAppConfig';
import { useAuthLoginRequired } from '@/hooks/useAuthLoginRequired';

export function LoginPanel() {
  const { t } = useTranslation('common');
  const { reload } = useReloadAppConfig();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) {
      setError(t('auth.tokenRequired'));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await verifyHelloWithToken(trimmed);
      saveAuthToken(trimmed);
      setAuthLoginRequired(false);
      await reload();
    } catch {
      setError(t('auth.invalidToken'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('auth.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.description')}</p>
        </div>
        <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="auth-token">{t('auth.tokenLabel')}</Label>
            <Input
              id="auth-token"
              data-testid="login-panel-token-input"
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder={t('auth.tokenPlaceholder')}
              disabled={submitting}
            />
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <Button
            type="submit"
            className="w-full"
            data-testid="login-panel-submit"
            disabled={submitting}
          >
            {submitting ? t('loading') : t('auth.signIn')}
          </Button>
        </form>
      </div>
    </div>
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const loginRequired = useAuthLoginRequired();

  if (loginRequired) {
    return <LoginPanel />;
  }

  return children;
}
