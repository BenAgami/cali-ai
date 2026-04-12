import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { themes, ThemeNames, ThemeColors } from "../theme/colors";

type ThemeContextType = {
  currentTheme: ThemeNames;
  toggleTheme: () => void;
  colors: ThemeColors;
};

export const ThemeContext = createContext<ThemeContextType>({
  currentTheme: "light",
  toggleTheme: () => {},
  colors: themes.light,
});

const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeNames>("light");

  useEffect(() => {
    const getTheme = async () => {
      try {
        const savedTheme = (await AsyncStorage.getItem(
          "theme",
        )) as ThemeNames | null;

        if (savedTheme && themes[savedTheme]) {
          setTheme(savedTheme);
        }
      } catch (e) {
        console.warn("[ThemeContext] Failed to load theme from storage", e);
      }
    };
    getTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme: ThemeNames = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    try {
      await AsyncStorage.setItem("theme", newTheme);
    } catch (e) {
      console.warn("[ThemeContext] Failed to persist theme to storage", e);
    }
  };

  const colors: ThemeColors = themes[theme];

  return (
    <ThemeContext.Provider value={{ currentTheme: theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};

export default ThemeProvider;
