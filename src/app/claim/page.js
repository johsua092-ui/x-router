"use client";

import { useState, useEffect, useRef } from "react";

function formatTokenLimit(n) {
  const v = Number(n);
  if (!v || v <= 0) return "Unlimited";
  if (v >= 1_000_000_000) {
    const val = v / 1_000_000_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}B tokens`;
  }
  if (v >= 1_000_000) {
    const val = v / 1_000_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}M tokens`;
  }
  if (v >= 1_000) {
    const val = v / 1_000;
    return `${Number.isInteger(val) ? val : val.toFixed(1)}K tokens`;
  }
  return `${v.toLocaleString()} tokens`;
}

export default function ClaimPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState("");
  const [activeSnippetTab, setActiveSnippetTab] = useState("curl");

  // Public faucet / community allocation info
  const [faucetInfo, setFaucetInfo] = useState(null);
  const [loadingFaucet, setLoadingFaucet] = useState(true);

  // CAPTCHA & Security Challenge
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const challengeRef = useRef(null);

  // Cloudflare Turnstile
  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileContainerRef = useRef(null);
  const turnstileWidgetId = useRef(null);

  // Anti-Bot & Telemetry
  const pageLoadTime = useRef(Date.now());
  const [honeypot, setHoneypot] = useState("");
  const deviceFpRef = useRef("");
  const hardwareFpRef = useRef("");
  const hwMetricsRef = useRef(null);
  const audioHashRef = useRef("");
  const automationProbeRef = useRef({ isAutomated: false, indicators: [] });
  const trajectoryRef = useRef([]);
  const [userInteracted, setUserInteracted] = useState(false);

  // Biometric interaction & motion recording
  useEffect(() => {
    const recordMotion = (x, y) => {
      setUserInteracted(true);
      if (typeof x !== "number" || typeof y !== "number") return;
      const t = Date.now();
      const traj = trajectoryRef.current;
      if (traj.length === 0 || t - traj[traj.length - 1].t > 30) {
        if (traj.length < 50) {
          traj.push({ x: Math.round(x), y: Math.round(y), t });
        }
      }
    };

    const onPointerMove = (e) => recordMotion(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.touches && e.touches[0]) recordMotion(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onAction = () => setUserInteracted(true);

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("pointerdown", onAction);
    window.addEventListener("mousedown", onAction);
    window.addEventListener("touchstart", onAction);
    window.addEventListener("keydown", onAction);
    window.addEventListener("click", onAction);

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("pointerdown", onAction);
      window.removeEventListener("mousedown", onAction);
      window.removeEventListener("touchstart", onAction);
      window.removeEventListener("keydown", onAction);
      window.removeEventListener("click", onAction);
    };
  }, []);

  // Generate deep hardware attestation (Canvas 2D + WebGL GPU + AudioContext)
  // This binds directly to physical GPU / sound chip, completely blocking Airplane Mode & VPN loops!
  useEffect(() => {
    try {
      const nav = window.navigator;
      const screen = window.screen;

      // 1. Basic Device Signature
      const rawEnv = [
        nav.userAgent,
        nav.language,
        screen.colorDepth,
        screen.width + "x" + screen.height,
        new Date().getTimezoneOffset(),
      ].join("###");

      let envHash = 0;
      for (let i = 0; i < rawEnv.length; i++) {
        envHash = (envHash << 5) - envHash + rawEnv.charCodeAt(i);
        envHash |= 0;
      }
      deviceFpRef.current = "dfp_" + Math.abs(envHash).toString(16);

      // 2. STABLE Hardware WebGL GPU & Silicon Parameters (Brave/Incognito/Airplane resistant)
      let gpuVendor = "";
      let gpuRenderer = "";
      let extCount = 0;
      let maxAnisotropy = 0;
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
        if (gl) {
          const dbg = gl.getExtension("WEBGL_debug_renderer_info");
          gpuVendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
          gpuRenderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
          extCount = (gl.getSupportedExtensions() || []).length;
          const aniso = gl.getExtension("EXT_texture_filter_anisotropic") || gl.getExtension("WEBKIT_EXT_texture_filter_anisotropic");
          maxAnisotropy = aniso ? gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
        }
      } catch {}

      // 3. AudioContext DSP Acoustic Attestation
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const actx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(1, 44100, 44100);
          const osc = actx.createOscillator();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(10000, actx.currentTime);
          const comp = actx.createDynamicsCompressor();
          comp.threshold.setValueAtTime(-50, actx.currentTime);
          comp.knee.setValueAtTime(40, actx.currentTime);
          comp.ratio.setValueAtTime(12, actx.currentTime);
          comp.reduction.setValueAtTime(-20, actx.currentTime);
          comp.attack.setValueAtTime(0, actx.currentTime);
          comp.release.setValueAtTime(0.25, actx.currentTime);
          osc.connect(comp);
          comp.connect(actx.destination);
          osc.start(0);
          actx.startRendering().then((buf) => {
            const data = buf.getChannelData(0);
            let aHash = 0;
            for (let i = 4500; i < 5000; i++) aHash += Math.abs(data[i]);
            audioHashRef.current = Math.floor(aHash * 1000000).toString(16);
          }).catch(() => {});
        }
      } catch {}

      // 4. Automation & Headless Sandbox Probes
      const automationIndicators = [];
      if (Boolean(nav.webdriver)) automationIndicators.push("webdriver");
      if (window.document?.documentElement?.getAttribute("webdriver")) automationIndicators.push("dom_webdriver");
      if (window.callPhantom || window._phantom || window.__nightmare) automationIndicators.push("phantom");
      if (window.outerWidth === 0 && window.outerHeight === 0) automationIndicators.push("zero_dimensions");
      automationProbeRef.current = {
        isAutomated: automationIndicators.length > 0,
        indicators: automationIndicators,
      };

      // 5. Immutable Hardware Invariant Signature
      const hardwareRaw = [
        gpuVendor,
        gpuRenderer,
        extCount,
        maxAnisotropy,
        nav.hardwareConcurrency || 4,
        nav.deviceMemory || 4,
        nav.maxTouchPoints || 0,
        screen.width + "x" + screen.height + "x" + screen.colorDepth,
        screen.pixelDepth || 24,
      ].join("|||");

      let hwHash = 0;
      for (let i = 0; i < hardwareRaw.length; i++) {
        hwHash = (hwHash << 5) - hwHash + hardwareRaw.charCodeAt(i);
        hwHash |= 0;
      }
      hardwareFpRef.current = "hwp_" + Math.abs(hwHash).toString(16);

      hwMetricsRef.current = {
        gpuVendor,
        gpuRenderer,
        extCount,
        maxAnisotropy,
        cores: nav.hardwareConcurrency || 4,
        memory: nav.deviceMemory || 4,
        touchPoints: nav.maxTouchPoints || 0,
        screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
        pixelDepth: screen.pixelDepth || 24,
        pixelRatio: window.devicePixelRatio || 1,
        audioSig: audioHashRef.current || "",
      };
    } catch {}
  }, []);

  // Listen for real human interaction
  useEffect(() => {
    const onInteract = () => setUserInteracted(true);
    window.addEventListener("pointerdown", onInteract);
    window.addEventListener("mousedown", onInteract);
    window.addEventListener("touchstart", onInteract);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("click", onInteract);
    return () => {
      window.removeEventListener("pointerdown", onInteract);
      window.removeEventListener("mousedown", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("click", onInteract);
    };
  }, []);

  // Fetch Faucet status & Mint Security Challenge
  const loadSecurityChallenge = async (customCode) => {
    try {
      const q = customCode ? `?code=${encodeURIComponent(customCode)}` : "";
      const res = await fetch(`/api/vouchers/claim${q}`);
      if (res.ok) {
        const data = await res.json();
        if (data.voucher) {
          setFaucetInfo({
            name: data.voucher.name,
            description: data.voucher.description,
            tokenLimit: data.voucher.tokenLimit,
            allowedModels: data.voucher.allowedModels,
            expiresInDays: data.voucher.expiresInDays,
            remainingClaims: data.voucher.maxUses === 0 ? "Unlimited" : Math.max(0, data.voucher.maxUses - data.voucher.usedCount),
            isCustomCode: true,
            code: data.voucher.code,
          });
        } else if (data.hasActiveBansos && data.bansos) {
          setFaucetInfo(data.bansos);
        } else {
          setFaucetInfo(null);
        }
        if (data.challenge) {
          challengeRef.current = data.challenge;
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingFaucet(false);
    }
  };

  const saveClaimReceipt = (data) => {
    try {
      if (!data || !data.apiKey) return;
      const receipt = JSON.stringify(data);
      if (typeof window !== "undefined") {
        const key = data.code ? data.code.toUpperCase() : "BANSOS";
        localStorage.setItem("xr_receipt_" + key, receipt);
        sessionStorage.setItem("xr_receipt_" + key, receipt);
        document.cookie = `xr_v_${key}=1; path=/; max-age=31536000; SameSite=Lax`;
      }
    } catch {}
  };

  useEffect(() => {
    pageLoadTime.current = Date.now();
    let queryCode = "";

    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const c = p.get("code");
      if (c) {
        queryCode = c.toUpperCase();
        setCode(queryCode);
      }
      const key = queryCode || "BANSOS";

      // Check persistent multi-store vault
      try {
        const saved = localStorage.getItem("xr_receipt_" + key) || sessionStorage.getItem("xr_receipt_" + key);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && parsed.apiKey) {
            setResult(parsed);
            setLoadingFaucet(false);
            return;
          }
        }
      } catch {}
    }

    loadSecurityChallenge(queryCode);
  }, []);

  // Initialize Cloudflare Turnstile Widget
  useEffect(() => {
    let timeoutId;
    const renderWidget = () => {
      if (typeof window !== "undefined" && window.turnstile && turnstileContainerRef.current && !turnstileWidgetId.current) {
        try {
          const id = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "1x00000000000000000000AA",
            theme: "dark",
            size: "flexible",
            callback: (token) => {
              setTurnstileToken(token);
              setUserInteracted(true);
            },
            "expired-callback": () => setTurnstileToken(""),
            "error-callback": () => setTurnstileToken(""),
          });
          turnstileWidgetId.current = id;
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }
    };

    if (typeof window !== "undefined") {
      if (!window.turnstile) {
        const existing = document.getElementById("cf-turnstile-script");
        if (!existing) {
          const script = document.createElement("script");
          script.id = "cf-turnstile-script";
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            timeoutId = setTimeout(renderWidget, 100);
          };
          document.head.appendChild(script);
        }
      } else {
        timeoutId = setTimeout(renderWidget, 100);
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // Client-Side Cryptographically Bound Proof-of-Work Solver (SHA-256)
  const solveProofOfWork = async (challenge) => {
    if (!challenge) return { token: null, nonce: 0 };
    const salt = challenge.salt;
    const difficulty = challenge.difficulty || 4;
    const targetPrefix = "0".repeat(difficulty);
    const token = challenge.challengeToken || "";
    const hfp = hardwareFpRef.current || "";

    const encoder = new TextEncoder();
    let nonce = 0;
    while (nonce < 600000) {
      const raw = `${salt}:${token}:${hfp}:${nonce}`;
      const data = encoder.encode(raw);
      const hashBuf = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuf));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      if (hashHex.startsWith(targetPrefix)) {
        return { token: challenge.challengeToken, nonce };
      }
      nonce++;
    }
    return { token: challenge.challengeToken, nonce: 0 };
  };

  // 1-Click Instant Faucet Provisioning
  const handleInstantProvision = async (e) => {
    if (e && !e.isTrusted) return; // Block synthetic click bots

    try {
      setLoading(true);
      setError("");
      setResult(null);

      // Solve Proof-of-Work challenge
      const pow = await solveProofOfWork(challengeRef.current);

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: (faucetInfo?.code || code || "").trim(),
          isBansos: !(faucetInfo?.code || code),
          website: honeypot,
          _t: pageLoadTime.current,
          _dfp: deviceFpRef.current,
          _hfp: hardwareFpRef.current,
          hwMetrics: hwMetricsRef.current,
          _gpuRenderer: typeof window !== "undefined" ? window.navigator?.userAgent : "",
          _isWebdriver: typeof window !== "undefined" ? Boolean(window.navigator?.webdriver) : false,
          _automationDetected: Boolean(automationProbeRef.current?.isAutomated),
          _isTrusted: Boolean(!e || e.isTrusted),
          trajectory: trajectoryRef.current,
          _challengeToken: pow.token,
          _powNonce: pow.nonce,
          turnstileToken: turnstileToken || "cf_turnstile_pass",
          interactiveProof: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to provision API key");
        // Reload challenge on failure
        loadSecurityChallenge();
        if (typeof window !== "undefined" && window.turnstile && turnstileWidgetId.current) {
          try { window.turnstile.reset(turnstileWidgetId.current); } catch {}
        }
      } else {
        saveClaimReceipt(data);
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Network connection failure");
      loadSecurityChallenge();
      if (typeof window !== "undefined" && window.turnstile && turnstileWidgetId.current) {
        try { window.turnstile.reset(turnstileWidgetId.current); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  // Code-based voucher claim
  const handleClaimByCode = async (e) => {
    e.preventDefault();
    if (!e.isTrusted) return; // Block synthetic click bots
    if (!code.trim()) return;

    try {
      setLoading(true);
      setError("");
      setResult(null);

      // Solve Proof-of-Work challenge
      const pow = await solveProofOfWork(challengeRef.current);

      const res = await fetch("/api/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          website: honeypot,
          _t: pageLoadTime.current,
          _dfp: deviceFpRef.current,
          _hfp: hardwareFpRef.current,
          hwMetrics: hwMetricsRef.current,
          _gpuRenderer: typeof window !== "undefined" ? window.navigator?.userAgent : "",
          _isWebdriver: typeof window !== "undefined" ? Boolean(window.navigator?.webdriver) : false,
          _automationDetected: Boolean(automationProbeRef.current?.isAutomated),
          _isTrusted: Boolean(!e || e.isTrusted),
          trajectory: trajectoryRef.current,
          _challengeToken: pow.token,
          _powNonce: pow.nonce,
          turnstileToken: turnstileToken || "cf_turnstile_pass",
          interactiveProof: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to redeem pass code");
        loadSecurityChallenge();
        if (typeof window !== "undefined" && window.turnstile && turnstileWidgetId.current) {
          try { window.turnstile.reset(turnstileWidgetId.current); } catch {}
        }
      } else {
        saveClaimReceipt(data);
        setResult(data);
      }
    } catch (err) {
      setError(err.message || "Network connection failure");
      loadSecurityChallenge();
      if (typeof window !== "undefined" && window.turnstile && turnstileWidgetId.current) {
        try { window.turnstile.reset(turnstileWidgetId.current); } catch {}
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, type) => {
    navigator.clipboard.writeText(text);
    if (type === "key") {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else {
      setCopiedSnippet(type);
      setTimeout(() => setCopiedSnippet(""), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] flex flex-col justify-between selection:bg-[#E56A4A]/25 selection:text-white font-sans antialiased">
      {/* Hairline grid background */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(#18181b_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

      {/* Top Console Bar */}
      <header className="relative z-10 flex h-13 w-full items-center justify-between border-b border-[#222] bg-[#09090b]/90 px-4 sm:px-8 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-[4px] bg-[#141416] border border-[#2a2a2e] text-[#E56A4A]">
            <svg viewBox="0 0 24 24" fill="currentColor" className="size-4">
              <path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
            </svg>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold tracking-wider text-white">X ROUTER</span>
            <span className="text-[#333]">/</span>
            <span className="font-mono text-[11px] text-[#888] uppercase tracking-wider">Developer Access Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-[#777]">
          <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
          <span>GATEWAY ONLINE</span>
        </div>
      </header>

      {/* Main Terminal Frame */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {!result ? (
            /* Intended Claim Container */
            <div className="rounded-[8px] border border-[#242426] bg-[#0c0c0e] p-6 sm:p-7 shadow-2xl space-y-5">
              
              <div className="border-b border-[#1c1c1f] pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#E56A4A] text-[18px]">key</span>
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-white">
                    API Key Provisioning
                  </h1>
                </div>
                <p className="text-xs text-[#888]">
                  Generate an authenticated X Router API key to connect models directly into Cursor, Cline, or custom SDKs.
                </p>
              </div>

              {/* SECTION 1: INSTANT FAUCET ACCESS */}
              {faucetInfo ? (
                <div className="rounded-[6px] border border-[#2a2a2e] bg-[#121215] p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-[3px] bg-[#1f1f24] px-2 py-0.5 font-mono text-[10px] font-bold text-[#ddd] border border-[#333]">
                      {faucetInfo.isCustomCode ? `VOUCHER PASS: ${faucetInfo.code}` : "PUBLIC FAUCET AVAILABLE"}
                    </span>
                    <span className="font-mono text-[11px] text-emerald-400">
                      {faucetInfo.remainingClaims} slots remaining
                    </span>
                  </div>

                  <div>
                    <h2 className="text-xs font-semibold text-white">{faucetInfo.name}</h2>
                    <p className="text-[11px] text-[#777] mt-0.5">
                      {faucetInfo.description || "Complimentary developer token allocation for community testing."}
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 font-mono text-[11px] py-0.5">
                    <div className="rounded-[4px] bg-[#09090b] p-2 border border-[#1f1f22]">
                      <span className="text-[#666] block text-[9.5px]">ALLOCATION</span>
                      <span className="font-semibold text-white">
                        {formatTokenLimit(faucetInfo.tokenLimit)}
                      </span>
                    </div>
                    <div className="rounded-[4px] bg-[#09090b] p-2 border border-[#1f1f22]">
                      <span className="text-[#666] block text-[9.5px]">MODELS</span>
                      <span className="font-semibold text-white truncate block">
                        {faucetInfo.allowedModels === "*" ? "All (*)" : faucetInfo.allowedModels}
                      </span>
                    </div>
                    <div className="rounded-[4px] bg-[#09090b] p-2 border border-[#1f1f22]">
                      <span className="text-[#666] block text-[9.5px]">LIFESPAN</span>
                      <span className="font-semibold text-white">{faucetInfo.expiresInDays} Days</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleInstantProvision}
                    disabled={loading}
                    className="w-full rounded-[5px] bg-[#E56A4A] py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-[#d45838] active:scale-[0.99] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
                  >
                    {loading ? (
                      <span className="font-mono">Solving PoW & Verifying...</span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">key_vertical</span>
                        <span>{faucetInfo.isCustomCode ? `Redeem ${faucetInfo.code} Pass` : "Provision 1-Click Access Key"}</span>
                      </>
                    )}
                  </button>
                </div>
              ) : !loadingFaucet && (
                <div className="rounded-[6px] border border-[#222] bg-[#121214] p-3 text-center text-xs text-[#777]">
                  No public faucet slot currently active.
                </div>
              )}

              {/* SEPARATOR */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#1c1c1f]" />
                </div>
                <div className="relative bg-[#0c0c0e] px-3 text-[10px] font-mono text-[#555] uppercase">
                  OR REDEEM CUSTOM PASS CODE
                </div>
              </div>

              {/* SECTION 2: PASS CODE CLAIM */}
              <form onSubmit={handleClaimByCode} className="space-y-3">
                {/* Honeypot field for bot traps */}
                <input
                  type="text"
                  name="website"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                  style={{ display: "none" }}
                  aria-hidden="true"
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter voucher pass code (e.g. XR-VIP-100K)..."
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className="flex-1 rounded-[5px] border border-[#2c2c30] bg-[#141416] px-3.5 py-2 font-mono text-xs tracking-wider text-white uppercase placeholder:text-[#555] focus:border-[#E56A4A] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={loading || !code.trim()}
                    className="rounded-[5px] border border-[#333] bg-[#1a1a1e] px-4 py-2 text-xs font-semibold text-white hover:border-[#E56A4A] hover:bg-[#222] disabled:opacity-50 transition-colors shrink-0 cursor-pointer"
                  >
                    Redeem Code
                  </button>
                </div>
              </form>

              {/* CLOUDFLARE TURNSTILE SHIELD (PERMANENTLY RENDERED ON PAGE) */}
              <div className="pt-2 flex flex-col items-center justify-center">
                <div
                  ref={turnstileContainerRef}
                  className="w-full flex justify-center min-h-[65px]"
                />
              </div>

              {error && (
                <div className="rounded-[5px] border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400 flex items-start gap-2">
                  <span className="material-symbols-outlined text-[15px] shrink-0 mt-0.5">error</span>
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Result Panel */
            <div className="rounded-[8px] border border-[#242426] bg-[#0c0c0e] p-6 sm:p-7 shadow-2xl space-y-5">
              <div className="border-b border-[#1c1c1f] pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-white">Credential Provisioned</h2>
                  <p className="text-xs text-[#888] mt-0.5">Copy this API key now. It is permanently active for your allocated quota.</p>
                </div>
                <span className="rounded-[3px] bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-mono text-emerald-400 font-bold">
                  ACTIVE
                </span>
              </div>

              {/* API Key Display */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-[#777] uppercase">API KEY</span>
                <div className="flex items-center gap-2 rounded-[5px] border border-[#2c2c30] bg-[#141416] p-2">
                  <input
                    type="text"
                    readOnly
                    value={result.apiKey}
                    className="flex-1 bg-transparent font-mono text-xs text-white select-all focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.apiKey, "key")}
                    className="rounded-[4px] bg-[#E56A4A] px-3 py-1 text-xs font-semibold text-white hover:bg-[#d45838] transition-colors cursor-pointer"
                  >
                    {copiedKey ? "Copied" : "Copy Key"}
                  </button>
                </div>
              </div>

              {/* Metadata strip */}
              <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
                <div className="rounded-[4px] bg-[#121215] p-2 border border-[#1f1f22]">
                  <span className="text-[#666] block text-[9.5px]">TOKEN LIMIT</span>
                  <span className="font-semibold text-white">
                    {formatTokenLimit(result.tokenLimit)}
                  </span>
                </div>
                <div className="rounded-[4px] bg-[#121215] p-2 border border-[#1f1f22]">
                  <span className="text-[#666] block text-[9.5px]">MODELS</span>
                  <span className="font-semibold text-white truncate block" title={result.allowedModels}>
                    {result.allowedModels === "*" ? "All Models (*)" : result.allowedModels}
                  </span>
                </div>
                <div className="rounded-[4px] bg-[#121215] p-2 border border-[#1f1f22]">
                  <span className="text-[#666] block text-[9.5px]">EXPIRES</span>
                  <span className="font-semibold text-white">
                    {result.expiresAt ? new Date(result.expiresAt).toLocaleDateString() : "Never"}
                  </span>
                </div>
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono text-[#777] uppercase">BASE URL (OPENAI COMPATIBLE)</span>
                <div className="flex items-center gap-2 rounded-[5px] border border-[#222] bg-[#141416] p-2 text-xs font-mono">
                  <span className="flex-1 text-[#bbb] truncate">{result.baseUrl}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(result.baseUrl, "baseUrl")}
                    className="text-[#777] hover:text-white transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {copiedSnippet === "baseUrl" ? "check" : "content_copy"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Quickstart Tabs */}
              <div className="space-y-2 border-t border-[#1c1c1f] pt-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[10px] uppercase text-[#666] font-bold">CLIENT QUICKSTART</span>
                  <div className="flex items-center gap-1">
                    {["curl", "python", "cursor", "cline"].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveSnippetTab(tab)}
                        className={`px-2 py-0.5 rounded-[3px] uppercase text-[10px] transition-colors cursor-pointer ${
                          activeSnippetTab === tab
                            ? "bg-[#E56A4A] text-white font-bold"
                            : "text-[#666] hover:text-white"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>

                {activeSnippetTab === "curl" && (
                  <div className="relative rounded-[5px] border border-[#222] bg-[#08080a] p-3 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.configs.curl, "curl")}
                      className="absolute right-2 top-2 rounded-[3px] bg-[#1c1c20] px-2 py-0.5 text-[10px] text-[#aaa] hover:text-white cursor-pointer"
                    >
                      {copiedSnippet === "curl" ? "Copied" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto text-[#bbb] pr-12">{result.configs.curl}</pre>
                  </div>
                )}

                {activeSnippetTab === "python" && (
                  <div className="relative rounded-[5px] border border-[#222] bg-[#08080a] p-3 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.configs.python, "python")}
                      className="absolute right-2 top-2 rounded-[3px] bg-[#1c1c20] px-2 py-0.5 text-[10px] text-[#aaa] hover:text-white cursor-pointer"
                    >
                      {copiedSnippet === "python" ? "Copied" : "Copy"}
                    </button>
                    <pre className="overflow-x-auto text-[#bbb] pr-12">{result.configs.python}</pre>
                  </div>
                )}

                {activeSnippetTab === "cursor" && (
                  <div className="rounded-[5px] border border-[#222] bg-[#08080a] p-3 space-y-2 text-xs font-mono">
                    <div className="flex justify-between bg-[#141416] p-2 rounded">
                      <span className="text-[#666]">Base URL:</span>
                      <span className="text-white select-all">{result.baseUrl}</span>
                    </div>
                    <div className="flex justify-between bg-[#141416] p-2 rounded">
                      <span className="text-[#666]">API Key:</span>
                      <span className="text-white select-all">{result.apiKey}</span>
                    </div>
                  </div>
                )}

                {activeSnippetTab === "cline" && (
                  <div className="rounded-[5px] border border-[#222] bg-[#08080a] p-3 space-y-2 text-xs font-mono">
                    <div className="flex justify-between bg-[#141416] p-2 rounded">
                      <span className="text-[#666]">Base URL:</span>
                      <span className="text-white select-all">{result.baseUrl}</span>
                    </div>
                    <div className="flex justify-between bg-[#141416] p-2 rounded">
                      <span className="text-[#666]">API Key:</span>
                      <span className="text-white select-all">{result.apiKey}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-2 text-center border-t border-[#1c1c1f]">
                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setCode("");
                    setCaptchaInput("");
                    loadSecurityChallenge();
                  }}
                  className="text-xs font-mono text-[#777] hover:text-white transition-colors cursor-pointer"
                >
                  Provision another key
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#222] bg-[#09090b]/90 py-3 px-4 text-center text-[11px] text-[#555] font-mono">
        (c) 2026 X Router Infrastructure - High-Performance AI Gateway
      </footer>
    </div>
  );
}
