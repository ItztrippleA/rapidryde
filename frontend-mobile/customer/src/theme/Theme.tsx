import { createContext, useContext, useEffect } from "react";
import { Appearance } from "react-native";
import { dark, light, type Palette } from "./tokens";
import { useCustomerStore } from "../store/useCustomerStore";

const ThemeContext = createContext<Palette>(light);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useCustomerStore((s) => s.mode);
  useEffect(() => {
    if (typeof Appearance.setColorScheme !== "function") return;
    Appearance.setColorScheme(mode === "light" ? "light" : "dark");
  }, [mode]);
  return <ThemeContext.Provider value={mode === "light" ? light : dark}>{children}</ThemeContext.Provider>;
}

export function usePalette() {
  return useContext(ThemeContext);
}
