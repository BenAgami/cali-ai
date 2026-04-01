import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const AUTH_TOKEN_KEY = "@cali_auth_token";

type AuthContextType = {
  token: string | null;
  setToken: (token: string | null) => Promise<void>;
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
        const stored = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
        setTokenState(stored);
      } catch {
        // ignore
      } finally {
        setIsLoading(false);
      }
    };
    loadToken();
  }, []);

  const setToken = useCallback(async (newToken: string | null) => {
    setTokenState(newToken);
    try {
      if (newToken) {
        await AsyncStorage.setItem(AUTH_TOKEN_KEY, newToken);
      } else {
        await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

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
