"use client";

import { useState, useEffect } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { GITHUB_CONFIG } from "@/shared/constants/config";

// Update notices live in their own banner, so this dialog stays about the repo.
export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const neverShow = localStorage.getItem("xrouter:welcomeNeverShow") === "true";
    const justLoggedIn = sessionStorage.getItem("xrouter:justLoggedIn") === "true";

    if (neverShow || !justLoggedIn) {
      setIsOpen(false);
    } else {
      sessionStorage.removeItem("xrouter:justLoggedIn");
      setIsOpen(true);
    }
  }, []);

  const handleDontShowAgain = () => {
    localStorage.setItem("xrouter:welcomeNeverShow", "true");
    setIsOpen(false);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      closeOnOverlay={false}
      title="Selamat datang di X Router"
      size="md"
      footer={null}
    >
      <div className="space-y-5 text-text-main text-sm">
        <div className="relative flex flex-col items-center justify-center text-center px-6 pt-7 pb-6 gap-4 rounded-2xl border border-border-subtle overflow-hidden">
          {/* warm aurora di belakang logo */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 h-40 w-64 rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(closest-side, var(--color-brand-500), transparent)" }}
          />
          <div className="relative">
            <img
              src="/logo.png"
              alt="X Router"
              className="h-16 w-16 rounded-2xl shadow-[var(--shadow-warm)]"
            />
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
              <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-surface bg-brand-500" />
            </span>
          </div>
          <div className="relative space-y-1.5">
            <p className="text-base font-semibold tracking-tight">
              Gateway lo sudah nyala
            </p>
            <p className="text-text-muted text-xs max-w-xs mx-auto leading-relaxed">
              Endpoint OpenAI + Anthropic siap dipakai, katalog model lengkap, dan
              usage terpantau real-time dari dashboard ini.
            </p>
          </div>

          <div className="relative flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <a
              href={GITHUB_CONFIG.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto"
            >
              <Button variant="outline" icon="star" fullWidth>
                Star di GitHub
              </Button>
            </a>
            <Button variant="primary" icon="arrow_forward" onClick={handleClose} className="w-full sm:w-auto">
              Masuk ke Dashboard
            </Button>
          </div>

          <button
            type="button"
            onClick={handleDontShowAgain}
            className="relative text-xs text-text-muted hover:text-text-main transition-colors"
          >
            Jangan tampilkan lagi
          </button>
        </div>
      </div>
    </Modal>
  );
}
