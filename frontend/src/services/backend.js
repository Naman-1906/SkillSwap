const runtimeAppId = typeof globalThis !== 'undefined' ? globalThis.__app_id : undefined;
const appId = runtimeAppId || 'clustr-mongo';

const isLocalServiceUrl = (value) => {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

export const resolveServiceUrl = (configuredUrl, isProduction, fallbackUrl) =>
  configuredUrl && !(isProduction && isLocalServiceUrl(configuredUrl))
    ? configuredUrl
    : fallbackUrl;

const isLocalFrontend = typeof window === 'undefined' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const localBackendUrl = typeof window !== 'undefined'
  ? `${window.location.protocol}//${window.location.hostname}:5000`
  : 'http://127.0.0.1:5000';

const configuredSocketUrl = import.meta.env.VITE_SOCKET_URL;
const socketUrl =
  import.meta.env.DEV && isLocalFrontend
    ? localBackendUrl
    : resolveServiceUrl(
        configuredSocketUrl,
        import.meta.env.PROD,
        typeof window !== 'undefined'
          ? `${window.location.protocol}//${window.location.host}`
          : localBackendUrl,
      );

const configuredApiUrl = import.meta.env.VITE_API_URL;
const apiBaseUrl =
  import.meta.env.DEV && isLocalFrontend
    ? localBackendUrl
    : resolveServiceUrl(
        configuredApiUrl,
        import.meta.env.PROD,
        typeof window !== 'undefined' ? window.location.origin : '',
      );

export { appId, socketUrl, apiBaseUrl };
