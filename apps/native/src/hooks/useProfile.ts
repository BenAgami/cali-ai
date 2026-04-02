import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { useAuth } from "@src/context/AuthContext";
import { API_BASE } from "@src/lib/api";
import type { UserProfile } from "@src/types/user";

export function useProfile() {
  const { token } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      setError("Not authenticated. Please log in.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        setError("Failed to load profile.");
        return;
      }
      const json = await res.json();
      if (json.success && json.data) {
        setUser(json.data);
      } else {
        setError("Failed to load profile.");
      }
    } catch {
      setError("Network error. Please try again.");
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
