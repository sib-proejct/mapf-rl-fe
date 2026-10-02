import React, { createContext, useContext, useState, useEffect } from "react";
import { Language, translations } from "../../locales/translations";

export type Theme = "light" | "dark";

export interface ThemeLanguageContextType {
  theme: Theme;
  toggleTheme: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: (
    key: keyof (typeof translations)["ko"],
    params?: Record<string, string | number>,
  ) => string;
}

const ThemeLanguageContext = createContext<
  ThemeLanguageContextType | undefined
>(undefined);

export const ThemeLanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize theme from localStorage or system preference
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("mapf_theme");
      if (saved === "dark" || saved === "light") return saved;
      if (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
      ) {
        return "dark";
      }
    } catch {
      // localStorage may be restricted
    }
    return "light";
  });

  // Initialize language from localStorage or default 'ko'
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem("mapf_lang");
      if (saved === "ko" || saved === "en") return saved;
    } catch {
      // localStorage may be restricted
    }
    return "ko";
  });

  // Apply dark mode class to <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    try {
      localStorage.setItem("mapf_theme", theme);
    } catch {}
  }, [theme]);

  // Persist language
  useEffect(() => {
    try {
      localStorage.setItem("mapf_lang", language);
    } catch {}
  }, [language]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
  };

  const toggleLanguage = () => {
    setLanguageState((prev) => (prev === "ko" ? "en" : "ko"));
  };

  // Translation helper with param replacement
  const t = (
    key: keyof (typeof translations)["ko"],
    params?: Record<string, string | number>,
  ): string => {
    const dict = translations[language] || translations["ko"];
    let text = (dict as Record<string, string>)[key] || key;

    if (params) {
      Object.entries(params).forEach(([paramKey, paramVal]) => {
        text = text.replace(
          new RegExp(`\\{${paramKey}\\}`, "g"),
          String(paramVal),
        );
      });
    }

    return text;
  };

  return (
    <ThemeLanguageContext.Provider
      value={{
        theme,
        toggleTheme,
        language,
        setLanguage,
        toggleLanguage,
        t,
      }}
    >
      {children}
    </ThemeLanguageContext.Provider>
  );
};

export function useAppConfig(): ThemeLanguageContextType {
  const context = useContext(ThemeLanguageContext);
  if (!context) {
    throw new Error("useAppConfig must be used within a ThemeLanguageProvider");
  }
  return context;
}
