import React, { useEffect, useState } from 'react';
import { getAuthSession, loginUser, signupUser, updateUser } from '../services/mongoApi';

const PROFILE_NAME_STORAGE_KEY = 'clustr.profileName';

const LOGIN_FIELDS = [
  { id: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
  { id: 'password', label: 'Password', type: 'password', placeholder: 'Enter your password' },
];

const SIGNUP_FIELDS = [
  { id: 'name', label: 'Full name', type: 'text', placeholder: 'Your full name' },
  { id: 'email', label: 'Email address', type: 'email', placeholder: 'you@example.com' },
  { id: 'password', label: 'Create password', type: 'password', placeholder: 'Create a password' },
];

function AuthForm({
  fields,
  formValues,
  submitLabel,
  helperText,
  onChange,
  onSubmit,
  loading,
  error,
  success,
}) {
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {fields.map((field) => (
        <label key={field.id} className="block">
          <span className="mb-2 block text-sm font-medium text-[#d9dce5]">{field.label}</span>
          <input
            name={field.id}
            type={field.type}
            value={formValues[field.id] ?? ''}
            onChange={onChange}
            placeholder={field.placeholder}
            className="w-full rounded-2xl border border-white/12 bg-black/40 px-4 py-3 text-sm text-white placeholder:text-neutral-500 outline-none transition focus:border-lime-400 focus:bg-black/60 autofill:bg-transparent"
            style={{ WebkitTextFillColor: 'white' }}
          />
        </label>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-lime-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-lime-300"
      >
        {loading ? 'Please wait...' : submitLabel}
      </button>

      {error ? <p className="text-center text-sm text-red-300">{error}</p> : null}
      {success ? <p className="text-center text-sm text-lime-300">{success}</p> : null}
      <p className="text-center text-sm text-neutral-400">{helperText}</p>
    </form>
  );
}

export default function AuthPage({ onBack, onContinue }) {
  const [mode, setMode] = useState('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loginValues, setLoginValues] = useState({
    email: '',
    password: '',
  });
  const [signupValues, setSignupValues] = useState({
    name: '',
    email: '',
    password: '',
  });

  const activeValues = mode === 'login' ? loginValues : signupValues;

  const getStoredProfileName = () => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(PROFILE_NAME_STORAGE_KEY)?.trim() || '';
  };

  const storeProfileName = (value = '') => {
    if (typeof window === 'undefined') return;

    const trimmedValue = value.trim();
    if (!trimmedValue) {
      window.localStorage.removeItem(PROFILE_NAME_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(PROFILE_NAME_STORAGE_KEY, trimmedValue);
  };

  useEffect(() => {
    const storedName = getStoredProfileName();
    if (!storedName) return;

    setSignupValues((current) => (
      current.name.trim() ? current : { ...current, name: storedName }
    ));
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError('');
    setSuccess('');

    if (mode === 'login') {
      setLoginValues((current) => ({ ...current, [name]: value }));
      return;
    }

    setSignupValues((current) => ({ ...current, [name]: value }));
  };

  const syncClustrProfile = async (user, preferredName = '') => {
    if (!user?.uid) return user;

    const resolvedName =
      user.displayName?.trim() ||
      user.name?.trim() ||
      preferredName.trim() ||
      getStoredProfileName() ||
      user.email?.split('@')[0]?.trim() ||
      '';
    const updates = {};

    if (!user.displayName?.trim() && resolvedName) updates.displayName = resolvedName;
    if (!user.name?.trim() && resolvedName) updates.name = resolvedName;
    if (!user.username?.trim() && resolvedName) {
      const usernameBase = resolvedName.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 12);
      updates.username = `@${usernameBase || user.uid.substring(0, 4)}`;
    }

    storeProfileName(resolvedName);
    if (Object.keys(updates).length === 0) return user;

    try {
      return await updateUser(user.uid, updates);
    } catch (profileError) {
      console.error('Clustr profile synchronization failed:', profileError);
      return user;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (mode === 'login') {
        const loginUserResult = await loginUser(loginValues.email.trim(), loginValues.password);
        const user = await getAuthSession();
        if (!user?.uid || user.uid !== loginUserResult?.uid) {
          throw new Error('Your login session could not be verified. Please try again.');
        }
        const profileUser = await syncClustrProfile(user);
        await onContinue?.(profileUser, { mode: 'login' });
        return;
      }

      const signupUserResult = await signupUser(signupValues.name.trim(), signupValues.email.trim(), signupValues.password);
      const user = await getAuthSession();
      if (!user?.uid || user.uid !== signupUserResult?.uid) {
        throw new Error('Your account was created, but the login session could not be verified. Please try logging in.');
      }
      const profileUser = await syncClustrProfile(user, signupValues.name);
      setSuccess('Account created successfully.');
      await onContinue?.(profileUser, { mode: 'signup' });
    } catch (authError) {
      setError(authError?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden bg-[#0f1117] text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-[#18202d] via-[#10151f] to-[#0f1117]" />
        <div className="absolute left-[12%] top-[8%] h-72 w-72 rounded-full bg-lime-400/10 blur-[120px]" />
        <div className="absolute bottom-[8%] right-[10%] h-80 w-80 rounded-full bg-sky-400/10 blur-[140px]" />

        <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-center gap-12 px-6 py-10 lg:flex-row lg:items-center lg:px-12">
          <div className="max-w-xl">
            <button
              type="button"
              onClick={onBack}
              className="rounded-full border border-white/12 bg-white/5 px-4 py-2 text-sm text-neutral-300 transition hover:border-lime-400/40 hover:text-white"
            >
              Back to SkillSwap
              
            </button>

            <p className="mt-10 text-sm uppercase tracking-[0.35em] text-lime-400">Clustr access</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight md:text-6xl">
              Step into Clustr and start building meaningful connections.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-neutral-300">
              Create your space, discover people with shared interests, and keep your profile,
              conversations, and community presence in one connected platform.
            </p>
          </div>

          <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-[#141924]/80 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mb-6 flex rounded-full border border-white/10 bg-black/20 p-1">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'login' ? 'bg-lime-400 text-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Log in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setSuccess('');
                }}
                className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                  mode === 'signup' ? 'bg-lime-400 text-black' : 'text-neutral-300 hover:text-white'
                }`}
              >
                Sign up
              </button>
            </div>

            <h2 className="text-2xl font-semibold text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h2>
            <p className="mb-6 mt-2 text-sm text-neutral-400">
              {mode === 'login'
                ? 'Enter your credentials to continue.'
                : 'Set up your account and start building your profile.'}
            </p>

            {mode === 'login' ? (
              <AuthForm
                fields={LOGIN_FIELDS}
                formValues={activeValues}
                submitLabel="Log in"
                helperText="Need an account? Switch to Sign up above."
                onChange={handleChange}
                onSubmit={handleSubmit}
                loading={loading}
                error={error}
                success={success}
              />
            ) : (
              <AuthForm
                fields={SIGNUP_FIELDS}
                formValues={activeValues}
                submitLabel="Create account"
                helperText="Already have an account? Switch back to Log in above."
                onChange={handleChange}
                onSubmit={handleSubmit}
                loading={loading}
                error={error}
                success={success}
              />
            )}
          </div>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
          -webkit-text-fill-color: white !important;
          -webkit-box-shadow: 0 0 0px 1000px #1a1f2e inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}} />
    </>
  );
}
