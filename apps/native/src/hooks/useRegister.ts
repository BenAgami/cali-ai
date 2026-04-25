import { useState } from "react";
import { router } from "expo-router";
import { StatusCodes } from "http-status-codes";

import { useAuth } from "@src/context/AuthContext";
import { authApi, ApiError } from "@src/api";
import type { RegisterValues } from "@repo/common";

export const useRegister = () => {
  const { setToken } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleSignUp = async (data: RegisterValues) => {
    setError(null);
    try {
      const result = await authApi.register(data);
      await setToken(result.token);
      router.replace("/");
    } catch (err) {
      if (err instanceof ApiError && err.status === StatusCodes.CONFLICT) {
        setError("An account with this email already exists.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    }
  };

  return { handleSignUp, error };
};
