import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import ThemeProvider from "@src/context/ThemeContext";
import { AuthProvider } from "@src/context/AuthContext";

const AppLayout = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SafeAreaProvider>
          <Stack>
            <Stack.Screen name="(main)" options={{ headerShown: false }} />
          </Stack>
        </SafeAreaProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default AppLayout;
