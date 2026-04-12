import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { tokenStore } from "@src/api/tokenStore";
import { registerUnauthenticatedHandler } from "@src/api/client";

type AuthContextType = {
  token: string | null;
  setToken: (token: string | null, refreshToken?: string) => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  token: null,
  setToken: async () => {},
  isLoading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadToken = async () => {
      try {
        const stored = await tokenStore.getAccessToken();
        setTokenState(stored);
      } catch (e) {
        console.warn("[AuthContext] Failed to load token from storage", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  useEffect(() => {
    registerUnauthenticatedHandler(() => setTokenState(null));
  }, []);

  const setToken = useCallback(
    async (newToken: string | null, refreshToken?: string) => {
      setTokenState(newToken);
      try {
        if (newToken) {
          await tokenStore.setTokens(newToken, refreshToken);
        } else {
          await tokenStore.clearTokens();
        }
      } catch (e) {
        console.warn("[AuthContext] Failed to persist token to storage", e);
      }
    },
    [],
  );

  return (
    <AuthContext.Provider value={{ token, setToken, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};

export default AuthContext;
