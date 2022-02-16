import 'tailwindcss/tailwind.css';
import type { AppProps } from 'next/app';
import { useEffect } from 'react';

import { useTokenStore } from 'components/Token';

function MyApp({ Component, pageProps }: AppProps) {
  const [, refreshToken] = useTokenStore();
  useEffect(() => {
    async function refreshOnce() {
      try {
        const { token, validUntil } = await refreshToken();
        if (token == null) {
          // 60 seconds
          return 60 * 1000;
        } else if (validUntil == null) {
          // does not expire
          return null;
        } else {
          // 30 seconds before expiration
          return validUntil.getTime() - Date.now() - 30 * 1000;
        }
      } catch (e) {
        console.error(e);
        return 30 * 1000;
      }
    }

    let timeoutHandle: number | null = null;
    let destroyed = false;
    async function run() {
      timeoutHandle = null;
      const timeout = await refreshOnce();
      if (!destroyed && timeout != null) {
        timeoutHandle = window.setTimeout(run, timeout);
      }
    }

    run();
    return () => {
      if (timeoutHandle != null) {
        window.clearTimeout(timeoutHandle);
      }
      destroyed = true;
    };
  }, [refreshToken]);

  return <Component {...pageProps} />;
}

export default MyApp;
