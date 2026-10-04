import "./globals.css";
import { ThemeProvider } from "@/shared/components/ThemeProvider";

export const metadata = {
  title: "X Router — OpenAI + Anthropic Gateway",
  description:
    "One endpoint for all your AI providers. Manage keys, monitor usage, and route anything.",
  icons: { icon: "/logo.png" },
};

export const viewport = { themeColor: "#1a1a1a" };

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* terapkan tema sebelum paint pertama — cegah flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('xr_theme');document.documentElement.classList.add(t==='light'?'light':'dark')}catch(e){document.documentElement.classList.add('dark')}`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `var d=document,r=d.documentElement,f=function(){r.classList.add('fonts-loaded')};if(d.fonts&&d.fonts.load){d.fonts.load('24px "Material Symbols Outlined"').then(f).catch(f);setTimeout(f,3000)}else{f()}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
