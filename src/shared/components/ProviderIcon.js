"use client";

export default function ProviderIcon({
  providerId,
  alt,
  size = 32,
  className = "",
  fallbackText = "?",
  fallbackColor,
}) {
  const src = providerId ? `/providers/${String(providerId).toLowerCase()}.png` : null;

  if (!src) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold rounded-lg ${className}`.trim()}
        style={{
          width: size,
          height: size,
          color: fallbackColor || "var(--color-primary)",
          fontSize: Math.max(10, Math.floor(size * 0.38)),
          background: "var(--color-surface-2)",
        }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || providerId}
      width={size}
      height={size}
      className={`object-contain rounded-lg ${className}`.trim()}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        el.style.display = "none";
        const fb = el.nextSibling;
        if (fb) fb.style.display = "inline-flex";
      }}
    />
  );
}
