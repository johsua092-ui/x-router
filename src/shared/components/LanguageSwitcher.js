"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { LOCALES, LOCALE_COOKIE, normalizeLocale } from "@/i18n/config";
import { reloadTranslations } from "@/i18n/runtime";

function getLocaleFromCookie() {
  if (typeof document === "undefined") return "en";
  const cookie = document.cookie
    .split(";")
    .find((c) => c.trim().startsWith(`${LOCALE_COOKIE}=`));
  const value = cookie ? decodeURIComponent(cookie.split("=")[1]) : "en";
  return normalizeLocale(value);
}

// Locale display names and code badges - will be translated by runtime i18n
const getLocaleInfo = (locale) => {
  const locales = {
    "en": { name: "English", code: "EN" },
    "vi": { name: "Tiếng Việt", code: "VI" },
    "zh-CN": { name: "简体中文", code: "ZH" },
    "zh-TW": { name: "繁體中文", code: "TW" },
    "ja": { name: "日本語", code: "JA" },
    "pt-BR": { name: "Português (Brasil)", code: "PT" },
    "pt-PT": { name: "Português (Portugal)", code: "PT-PT" },
    "ko": { name: "한국어", code: "KO" },
    "es": { name: "Español", code: "ES" },
    "de": { name: "Deutsch", code: "DE" },
    "fr": { name: "Français", code: "FR" },
    "he": { name: "עברית", code: "HE" },
    "ar": { name: "العربية", code: "AR" },
    "ru": { name: "Русский", code: "RU" },
    "pl": { name: "Polski", code: "PL" },
    "cs": { name: "Čeština", code: "CS" },
    "nl": { name: "Nederlands", code: "NL" },
    "tr": { name: "Türkçe", code: "TR" },
    "uk": { name: "Українська", code: "UK" },
    "tl": { name: "Tagalog", code: "TL" },
    "id": { name: "Indonesia", code: "ID" },
    "th": { name: "ไทย", code: "TH" },
    "km": { name: "ខ្មែរ", code: "KM" },
    "hi": { name: "हिन्दी", code: "HI" },
    "bn": { name: "বাংলা", code: "BN" },
    "ur": { name: "اردو", code: "UR" },
    "ro": { name: "Română", code: "RO" },
    "sv": { name: "Svenska", code: "SV" },
    "it": { name: "Italiano", code: "IT" },
    "el": { name: "Ελληνικά", code: "EL" },
    "hu": { name: "Magyar", code: "HU" },
    "fi": { name: "Suomi", code: "FI" },
    "da": { name: "Dansk", code: "DA" },
    "no": { name: "Norsk", code: "NO" },
    "fa": { name: "فارسی", code: "FA" }
  };
  return locales[locale] || { name: locale, code: locale.slice(0, 2).toUpperCase() };
};

export default function LanguageSwitcher({ className = "", isOpen: controlledOpen, onClose, hideTrigger = false }) {
  const [locale, setLocale] = useState("en");
  const [isPending, setIsPending] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const modalRef = useRef(null);

  const isControlled = typeof controlledOpen === "boolean";
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = (value, nextLocale = locale) => {
    if (isControlled) {
      if (!value && onClose) onClose(nextLocale);
    } else {
      setInternalOpen(value);
    }
  };

  useEffect(() => {
    setLocale(getLocaleFromCookie());
  }, []);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSetLocale = async (nextLocale) => {
    if (nextLocale === locale || isPending) return;

    setIsPending(true);
    try {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });
      
      // Reload translations without full page reload
      await reloadTranslations();
      setLocale(nextLocale);
      setIsOpen(false, nextLocale);
    } catch (err) {
      console.error("Failed to set locale:", err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className={className}>
      {/* Trigger button */}
      {!hideTrigger && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isPending}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-muted hover:text-text-main hover:bg-surface/60 transition-colors"
          title="Language"
          data-i18n-skip="true"
        >
          <span className="material-symbols-outlined text-[20px]">language</span>
          <span className="text-sm font-medium">{getLocaleInfo(locale).name}</span>
          <span className="font-mono text-[11px] font-semibold tracking-wider">{getLocaleInfo(locale).code}</span>
        </button>
      )}

      {/* Portal modal - renders at document.body to avoid parent layout constraints */}
      {isOpen && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-i18n-skip="true">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal content */}
          <div
            ref={modalRef}
            className="relative w-full bg-surface border border-border rounded-[6px] shadow-[var(--shadow-elev)] animate-in fade-in zoom-in-95 duration-200 max-w-2xl flex flex-col max-h-[80vh]"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between p-3 border-b border-border-subtle">
              <h2 className="text-lg font-semibold text-text-main">Select Language</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:bg-surface-2 dark:hover:bg-surface-2 transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            {/* Modal body - fixed grid columns, equal sizing */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                {LOCALES.map((item) => {
                  const active = locale === item;
                  const info = getLocaleInfo(item);
                  return (
                    <button
                      key={item}
                      onClick={() => handleSetLocale(item)}
                      disabled={isPending}
                      className={`flex flex-col items-center justify-start gap-1 px-2 py-3 rounded-lg text-xs font-medium transition-colors w-full ${
                        active
                          ? "bg-primary/15 text-primary ring-2 ring-primary"
                          : "text-text-main hover:bg-surface-2 dark:hover:bg-surface-2"
                      } ${isPending ? "opacity-70 cursor-wait" : ""}`}
                      title={info.name}
                    >
                      <span className="font-mono text-[13px] font-semibold tracking-wider w-7 text-center shrink-0">{info.code}</span>
                      {/* Fixed 2-line height so all cards are uniform */}
                      <span className="text-center leading-tight line-clamp-2 h-8 flex items-center">{info.name}</span>
                      {active && (
                        <span className="material-symbols-outlined text-sm">check</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
