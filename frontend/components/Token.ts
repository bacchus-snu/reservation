import fetch from 'isomorphic-fetch';
import { createContext, useContext, useEffect, useState } from 'react';

const adminPermissionIdx = parseInt(process.env.NEXT_PUBLIC_ADMIN_PERMISSION || '7', 10);
const jwtEndpoint = (() => {
  const url = new URL('issue-jwt', process.env.NEXT_PUBLIC_ID_BASE);
  return url.toString();
})();

export type TokenState = {
  token: string | null;
  hasAdminPermission: boolean;
  validUntil?: Date;
  loading: boolean;
  error?: Error;
};

export class TokenStore {
  token: string | null = null;
  hasAdminPermission: boolean = false;
  validUntil?: Date = new Date(0);
  loading: boolean = true;
  error?: Error;

  stateUpdateListeners: Set<(state: TokenState) => void> = new Set();

  constructor() {
  }

  addStateUpdateListener(listener: (state: TokenState) => void) {
    this.stateUpdateListeners.add(listener);
  }

  removeStateUpdateListener(listener: (state: TokenState) => void) {
    this.stateUpdateListeners.delete(listener);
  }

  broadcastStateUpdate(state: TokenState) {
    for (const listener of this.stateUpdateListeners.values()) {
      listener(state);
    }
  }

  refresh: () => Promise<TokenState> = async () => {
    let state: TokenState = {
      token: this.token,
      hasAdminPermission: this.hasAdminPermission,
      validUntil: this.validUntil,
      loading: this.loading,
    };

    if (this.token != null) {
      // return token if valid
      const refreshIfAfter = new Date();
      refreshIfAfter.setSeconds(refreshIfAfter.getSeconds() + 30);
      if (this.validUntil == null || this.validUntil.getTime() >= refreshIfAfter.getTime()) {
        return state;
      }
    }

    try {
      this.loading = true;
      state = { ...state, loading: true };
      this.broadcastStateUpdate(state);

      const resp = await fetch(
        jwtEndpoint,
        {
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ permissionIdx: adminPermissionIdx }),
        },
      );

      let newToken: string | null = null;
      let hasPermission = false;
      let validUntil: Date | undefined = new Date(0);
      if (resp.status === 200) {
        const data: { token: string, hasPermission: boolean } = await resp.json();
        newToken = data.token;
        hasPermission = data.hasPermission;

        try {
          const [, payloadEncoded] = newToken.split('.');
          const payload = JSON.parse(window.atob(payloadEncoded));

          const expireAt = payload.exp;
          if (expireAt == null) {
            validUntil = undefined;
          } else {
            validUntil = new Date(expireAt * 1000);
          }
        } catch (e) {
          newToken = null;
          hasPermission = false;
          validUntil = new Date(0);
        }
      }

      this.token = newToken;
      this.hasAdminPermission = hasPermission;
      this.validUntil = validUntil;
      this.loading = false;
      this.error = undefined;
      state = {
        token: this.token,
        hasAdminPermission: this.hasAdminPermission,
        validUntil: this.validUntil,
        loading: false,
      };
      this.broadcastStateUpdate(state);
      return state;
    } catch (e) {
      this.loading = false;
      this.error = e;
      state = { ...state, loading: false, error: e };
      this.broadcastStateUpdate(state);
      return state;
    }
  };
}

const TokenContext = createContext<TokenStore>(new TokenStore());

export function useTokenStore(): [TokenState, () => Promise<TokenState>] {
  const store = useContext(TokenContext);
  const [state, setState] = useState<TokenState>({
    token: store.token,
    hasAdminPermission: store.hasAdminPermission,
    validUntil: store.validUntil,
    loading: store.loading,
    error: store.error,
  });

  useEffect(
    () => {
      store.addStateUpdateListener(setState);
      return () => store.removeStateUpdateListener(setState);
    },
    [store],
  );
  return [state, store.refresh];
}

export const TokenStoreProvider = TokenContext.Provider;

export type Payload = {
  userIdx: number;
  username: string;
  permissionIdx: number;
};

export function getPayloadFromToken(token: string): Payload {
  const [, payloadEncoded] = token.split('.');
  const payload: Payload = JSON.parse(window.atob(payloadEncoded));
  return payload;
}
