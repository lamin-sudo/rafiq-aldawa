import { createContext, useState, useEffect, useContext } from "react";

const ThemeContext =
  globalThis.__THEME_CONTEXT__ || (globalThis.__THEME_CONTEXT__ = createContext(null));

const STORAGE_KEY = "medi_companion_theme";

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || "light");

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-anim");
    setTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setTimeout(() => root.classList.remove("theme-anim"), 350);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
};