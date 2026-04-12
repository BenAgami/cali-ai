import { useState } from "react";
import { router } from "expo-router";

import { useAuth } from "@src/context/AuthContext";
import { authApi, ApiError } from "@src/api";
import type { LoginValues } from "@repo/common";

export const useLogin = () => {
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async (data: LoginValues) => {
    setError(null);
    try {
      const result = await authApi.login(data);
      await setToken(result.token);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid email or password.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return { handleSignIn, error };
};
