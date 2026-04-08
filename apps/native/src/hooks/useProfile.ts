import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";

import { useAuth } from "@src/context/AuthContext";
import { apiClient, ApiError } from "@src/lib/api";
import type { UserProfile } from "@src/types/user";

export function useProfile() {
  const { token } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!token) {
      router.replace("/(auth)/login");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await apiClient.get<UserProfile>("/api/users/me", token);
      setUser(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/(auth)/login");
        return;
      }
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      fetchUser();
    }, [fetchUser])
  );

  return { user, loading, error };
}
