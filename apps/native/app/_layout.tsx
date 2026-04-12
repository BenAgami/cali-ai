import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import ThemeProvider from "@src/context/ThemeContext";
import { AuthProvider } from "@src/context/AuthContext";
import { ApiError } from "@src/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 2;
      },
    },
  },
});

const AppLayout = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <SafeAreaProvider>
            <Stack>
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen name="(main)" options={{ headerShown: false }} />
            </Stack>
          </SafeAreaProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default AppLayout;
