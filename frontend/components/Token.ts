import fetch from 'isomorphic-fetch';
import { createContext, useContext, useEffect, useState } from 'react';

// TODO: make these configurable
const adminPermissionIdx = 7;
const jwtEndpoint = 'https://id.snucse.org/api/issue-jwt';

export type TokenState = {
  token: string | null;
  hasAdminPermission: boolean;
  validUntil?: Date;
};

export class TokenStore {
  token: string | null = null;
  hasAdminPermission: boolean = false;
  validUntil?: Date = new Date(0);

  stateUpdateListeners: Set<(state: TokenState) => void> = new Set();

  constructor() {
  }

  addStateUpdateListener(listener: (state: TokenState) => void) {
    this.stateUpdateListeners.add(listener);
  }

  removeStateUpdateListener(listener: (state: TokenState) => void) {
    this.stateUpdateListeners.delete(listener);
  }

  refresh: () => Promise<TokenState> = async () => {
    if (this.token != null) {
      // return token if valid
      const refreshIfAfter = new Date();
      refreshIfAfter.setSeconds(refreshIfAfter.getSeconds() + 30);
      if (this.validUntil == null || this.validUntil.getTime() >= refreshIfAfter.getTime()) {
        return {
          token: this.token,
          hasAdminPermission: this.hasAdminPermission,
          validUntil: this.validUntil,
        };
      }
    }

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

    const state = {
      token: newToken,
      hasAdminPermission: hasPermission,
      validUntil,
    };

    if (this.token !== newToken) {
      for (const listener of this.stateUpdateListeners.values()) {
        listener(state);
      }
    }

    this.token = newToken;
    this.hasAdminPermission = hasPermission;
    this.validUntil = validUntil;
    return state;
  };
}

const TokenContext = createContext<TokenStore>(new TokenStore());

export function useTokenStore(): [TokenState, () => Promise<TokenState>] {
  const store = useContext(TokenContext);
  const [state, setState] = useState<TokenState>({
    token: store.token,
    hasAdminPermission: store.hasAdminPermission,
    validUntil: store.validUntil,
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
