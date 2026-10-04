"use client";
import { useRouter } from "next/navigation";
import Navigation from "./components/Navigation";
import HeroSection from "./components/HeroSection";
import FlowAnimation from "./components/FlowAnimation";
import HowItWorks from "./components/HowItWorks";
import Features from "./components/Features";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage() {
  const router = useRouter();
  return (
    <div className="relative text-text-main font-sans overflow-x-hidden antialiased selection:bg-primary selection:text-white">
      {/* Animated Background */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-bg">
        {/* Identity motif: the ember veil. One warm glow, anchored to the top. */}
        <div
          className="absolute inset-x-0 top-0 h-[70vh]"
          style={{
            background:
              'radial-gradient(ellipse 75% 100% at 50% 0%, color-mix(in srgb, var(--color-primary) 16%, transparent), transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10">
        <Navigation />
        
        <main>
          {/* Hero with Flow Animation */}
          <div className="relative">
          <HeroSection />
          <div className="flex justify-center pb-20">
            <FlowAnimation />
          </div>
        </div>
        
        <GetStarted />
        <HowItWorks />
        <Features />
        
        {/* CTA Section */}
        <section className="py-32 px-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-t from-[var(--color-brand-500)]/5 to-transparent pointer-events-none"></div>
          <div className="max-w-4xl mx-auto text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-black mb-6">Ready to Simplify Your AI Infrastructure?</h2>
            <p className="text-xl text-text-muted mb-10 max-w-2xl mx-auto">
              Join the developers streamlining their AI integrations with free, open-source X Router.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => router.push("/dashboard")}
                className="w-full sm:w-auto h-14 px-10 rounded-lg bg-[var(--color-brand-500)] hover:bg-[#e0650a] text-[#181411] text-lg font-bold transition-all shadow-[0_0_20px_rgba(249,120,21,0.5)]"
              >
                Start Free
              </button>
              <button 
                onClick={() => window.open("https://github.com/johsua092-ui/x-router#readme", "_blank")}
                className="w-full sm:w-auto h-14 px-10 rounded-lg border border-[#3a2f27] hover:bg-[#23180f] text-white text-lg font-bold transition-all"
              >
                Read Documentation
              </button>
            </div>
          </div>
        </section>
        </main>
        
        <Footer />
      </div>
      
      {/* Global styles for keyframes */}
      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes dash {
          to { stroke-dashoffset: -20; }
        }
        @keyframes blob {
          0%, 100% { 
            transform: translate(0, 0) scale(1);
          }
          33% { 
            transform: translate(30px, -50px) scale(1.1);
          }
          66% { 
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        .animate-blob {
          animation: blob 20s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

