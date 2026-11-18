import { useState } from 'react';
import { Button, Field, Input } from '../components/ui';
import { useAuth } from '../hooks/auth';
import { saveBackendConfig } from '../lib/config';

export default function AuthScreen() {
  const { signIn, signUp, reload } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function go() {
    setMsg(''); setBusy(true);
    const e = mode === 'in' ? await signIn(email.trim(), pw) : await signUp(email.trim(), pw);
    setBusy(false);
    if (e) setMsg(e);
  }

  return (
    <div className="min-h-full grid place-items-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="Voyago" className="h-16 w-16 rounded-2xl" />
        <h1 className="text-2xl font-extrabold">{mode === 'in' ? 'Welcome back' : 'Create your account'}</h1>
        <Field label="Email"><Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password" hint={mode === 'up' ? 'At least 6 characters' : undefined}>
          <Input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {msg && <p className="text-sm font-semibold text-danger" role="alert">{msg}</p>}
        <Button full disabled={busy || !email || pw.length < 6} onClick={go}>{busy ? 'Please wait…' : mode === 'in' ? 'Sign in' : 'Sign up'}</Button>
        <button className="text-teal font-bold text-sm w-full" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(''); }}>
          {mode === 'in' ? 'New here? Create an account' : 'Have an account? Sign in'}
        </button>
        <button className="text-slate2 text-xs w-full" onClick={() => { saveBackendConfig(null); reload(); }}>Use offline on this device only</button>
      </div>
    </div>
  );
}
