"use client";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

export default function GetStarted() {
  const { copied, copy } = useCopyToClipboard();

  const handleCopy = (text) => {
    copy(text, "landing");
  };

  return (
    <section className="py-24 px-6 bg-[#120f0d]">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Left: Steps */}
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Get Started in 30 Seconds</h2>
            <p className="text-muted text-lg mb-8">
              Install X Router, configure your providers via web dashboard, and start routing AI requests.
            </p>
            
            <div className="flex flex-col gap-6">
              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)] flex items-center justify-center font-bold">1</div>
                <div>
                  <h4 className="font-bold text-lg">Install X Router</h4>
                  <p className="text-sm text-muted mt-1">Run npx command to start the server instantly</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)] flex items-center justify-center font-bold">2</div>
                <div>
                  <h4 className="font-bold text-lg">Open Dashboard</h4>
                  <p className="text-sm text-muted mt-1">Configure providers and API keys via web interface</p>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex-none w-8 h-8 rounded-full bg-[var(--color-brand-500)]/20 text-[var(--color-brand-500)] flex items-center justify-center font-bold">3</div>
                <div>
                  <h4 className="font-bold text-lg">Route Requests</h4>
                  <p className="text-sm text-muted mt-1">Point your CLI tools to http://localhost:20128</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Code block */}
          <div className="flex-1 w-full">
            <div className="rounded-xl overflow-hidden bg-[#1e1e1e] border border-[#3a2f27] shadow-2xl">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-3 bg-[#252526] border-b border-border">
                <div className="w-3 h-3 rounded-full bg-danger-solid"></div>
                <div className="w-3 h-3 rounded-full bg-warning-solid"></div>
                <div className="w-3 h-3 rounded-full bg-success-solid"></div>
                <div className="ml-2 text-xs text-muted font-mono">terminal</div>
              </div>
              
              {/* Terminal content */}
              <div className="p-6 font-mono text-sm leading-relaxed overflow-x-auto">
                <div 
                  className="flex items-center gap-2 mb-4 group cursor-pointer"
                  onClick={() => handleCopy("npx xrouter")}
                >
                  <span className="text-success">$</span>
                  <span className="text-white">npx xrouter</span>
                  <span className="ml-auto text-muted text-xs opacity-0 group-hover:opacity-100">
                    {copied === "landing" ? "Tersalin" : "Copy"}
                  </span>
                </div>
                
                <div className="text-muted mb-6">
                  <span className="text-[var(--color-brand-500)]">&gt;</span> Starting X Router...<br/>
                  <span className="text-[var(--color-brand-500)]">&gt;</span> Server running on <span className="text-info">http://localhost:20128</span><br/>
                  <span className="text-[var(--color-brand-500)]">&gt;</span> Dashboard: <span className="text-info">http://localhost:20128/dashboard</span><br/>
                  <span className="text-success">&gt;</span> Ready to route.
                </div>
                
                <div className="text-xs text-muted mb-2 border-t border-border pt-4">
                  Configure providers in dashboard or use environment variables
                </div>
                
                <div className="text-muted text-xs">
                  <span className="text-info">Data Location:</span><br/>
                  <span className="text-muted">  macOS/Linux:</span> ~/.xrouter/db/data.sqlite<br/>
                  <span className="text-muted">  Windows:</span> %APPDATA%/xrouter/db/data.sqlite
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

