import React, { createContext, useState, useEffect, useCallback, useContext } from "react";
import { useAuth } from "@/lib/AuthContext";
import { api } from "@/api/supabaseClient";
import ar from "./locales/ar";
import en from "./locales/en";
import fr from "./locales/fr";
// moment's relative/date formatting follows its own locale, which defaults to
// English -- so "a few seconds ago" leaked into the Arabic and French UIs.
import moment from "moment";
import "moment/locale/ar";
import "moment/locale/fr";

const dictionaries = { ar, en, fr };

export const LANGUAGES = [
  { code: "ar", label: "العربية", dir: "rtl" },
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
];

const STORAGE_KEY = "medi_companion_lang";
const DEFAULT_LANG = "ar";

// Keep the context reference stable across Vite HMR re-evaluations so that
// already-mounted providers and newly re-rendered consumers share the same
// context object (otherwise useI18n throws "must be used within I18nProvider").
const I18nContext = globalThis.__I18N_CONTEXT__ || (globalThis.__I18N_CONTEXT__ = createContext(null));

function resolveValue(dict, key) {
  return key.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), dict);
}

function interpolate(str, params) {
  if (!params || typeof str !== "string") return str;
  return str.replace(/\{(\w+)\}/g, (_, p) => (params[p] !== undefined ? String(params[p]) : `{${p}}`));
}

export const I18nProvider = ({ children }) => {
  const { user } = useAuth();
  const [lang, setLangState] = useState(() => localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG);

  const dir = lang === "ar" ? "rtl" : "ltr";

  const applyDocumentDir = useCallback((language, direction) => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
      document.documentElement.dir = direction;
    }
    // Keep moment's locale in step with the UI language (dates + "x ago").
    try {
      moment.locale(language);
    } catch {
      /* unsupported locale -> keep default */
    }
  }, []);

  // Keep document direction in sync with the active language
  useEffect(() => {
    applyDocumentDir(lang, dir);
  }, [lang, dir, applyDocumentDir]);

  // Cross-device: pull the saved language from the user profile when no local preference exists
  useEffect(() => {
    if (user && user.language && dictionaries[user.language] && !localStorage.getItem(STORAGE_KEY)) {
      setLangState(user.language);
    }
  }, [user]);

  const setLang = useCallback(
    async (language) => {
      if (!dictionaries[language]) return;
      // Apply the direction on <html> BEFORE React re-renders so the layout
      // mirrors in the same frame as the new strings -- flipping direction a
      // tick later is what produced the visible jump/flash.
      const direction = language === "ar" ? "rtl" : "ltr";
      const root = typeof document !== "undefined" ? document.documentElement : null;
      if (root) root.classList.add("lang-switching");
      applyDocumentDir(language, direction);
      setLangState(language);
      localStorage.setItem(STORAGE_KEY, language);
      // Release the mask on the next frame, once the mirrored layout has painted.
      if (root) requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("lang-switching")));
      // Persist to profile so the preference follows the user across devices
      try {
        await api.auth.updateMe({ language });
      } catch (e) {
        /* ignore — local preference is already stored */
      }
    },
    [applyDocumentDir]
  );

  const t = useCallback(
    (key, params) => {
      const dict = dictionaries[lang] || dictionaries[DEFAULT_LANG];
      let val = resolveValue(dict, key);
      if (val === undefined) {
        val = resolveValue(dictionaries[DEFAULT_LANG], key);
      }
      const result = interpolate(val, params);
      return result ?? key;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, dir, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return ctx;
};

export const useTranslation = () => {
  const { t } = useI18n();
  return t;
};