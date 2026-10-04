"use client";

import { cn } from "@/shared/utils/cn";

/* Avatar. Initials carry the brand tint at varying opacity rather than a
   random rainbow hue — identity stays inside the palette (R-29). */
export default function Avatar({ src, alt = "Avatar", name, size = "md", className }) {
  const sizes = {
    xs: "size-6 text-[10px]",
    sm: "size-8 text-xs",
    md: "size-10 text-sm",
    lg: "size-12 text-base",
    xl: "size-16 text-lg",
  };

  const getInitials = (value) => {
    if (!value) return "?";
    const parts = value.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return value.substring(0, 2).toUpperCase();
  };

  // Deterministic warm tint: same name always gets the same tone, all tones
  // are brand or neutral, so avatars never introduce a second accent colour.
  const tones = [
    "bg-brand-600",
    "bg-brand-700",
    "bg-brand-800",
    "bg-[#5c4a3d]",
    "bg-[#4a4a4a]",
  ];
  const toneFor = (value) => {
    if (!value) return tones[0];
    let sum = 0;
    for (let i = 0; i < value.length; i += 1) sum += value.charCodeAt(i);
    return tones[sum % tones.length];
  };

  if (src) {
    return (
      <div
        className={cn(
          "rounded-full bg-cover bg-center bg-no-repeat border border-border",
          sizes[size],
          className
        )}
        style={{ backgroundImage: `url(${src})` }}
        role="img"
        aria-label={alt}
      />
    );
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold text-white tracking-wide",
        sizes[size],
        toneFor(name),
        className
      )}
      role="img"
      aria-label={alt}
    >
      {getInitials(name)}
    </div>
  );
}
