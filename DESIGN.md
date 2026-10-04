# X Router — Design Direction

Direction ini berasal dari pemilik produk (joshz), ditulis apa adanya. Ini **bukan** panduan gaya buatan agen: warna, logo, dan password default adalah keputusan pemilik.

## Identity

- **Produk:** X Router, gateway LLM (OpenAI + Anthropic compatible) yang di-host sendiri.
- **Karakter:** tool infrastruktur yang hangat, bukan dashboard korporat dingin. Tegas, presisi, tapi tidak steril.
- **Motif identitas:** **garis ember** — aturan gradient oranye tipis (`from-transparent via-primary to-transparent`) yang berulang sebagai pemisah dan aksen brand. Satu gesture, dipakai konsisten.
- **Logo:** caduceus (tongkat Hermes). Keputusan pemilik, jangan diganti.

## Palette

| Peran | Nilai | Alasan |
|---|---|---|
| Brand / accent | `#E56A4A` (ember orange) | Identitas pemilik. Hangat, jarang dipakai produk lain, jadi pembeda langsung dari default biru-ungu AI. |
| Base dark | charcoal solid (`#0a0a0a` family) | Produk developer; tema gelap punya alasan fungsional (R-21), dan menahan oranye agar terbaca. |
| Base light | `#FDFAF6` (warm off-white) | Versi terang yang tetap hangat, bukan putih dingin generik. |
| Neutral | abu netral (`#6B7280` family) | Untuk teks sekunder, border, permukaan. Netral tidak dihitung ke palet inti. |

Palet inti: 1 base + 1 accent. Sesuai R-29.

## Typography

- **Sans:** Geist Sans. Alasan: produk developer, dan Geist punya bentuk numerik dan tabular yang rapi untuk tabel usage dan key. Dipilih sadar, bukan karena default.
- **Mono:** Geist Mono, khusus untuk nilai teknis: key, hash, endpoint, token, ID. Mono dipakai sebagai penanda data, bukan sebagai kostum "terminal".
- **Skala:** heading besar tegas untuk fokus, body tenang, label kecil untuk metadata.

## Surfaces

- **Solid, tanpa glassmorphism.** Blur/translucency sudah dihapus dari seluruh UI (R-10). Panel, sidebar, header, dan modal semuanya opak.
- **Elevation minimal.** Shadow hanya untuk modal dan dropdown yang benar-benar mengangkat diri dari halaman (R-12).
- **Glow dose cap:** maksimal 1 elemen sebagai focus accent (R-13).

## Dials

Dial: **ENERGY 2 / RHYTHM 2 / MOTION 1**

- ENERGY 2: hadir dan hangat, tapi tidak berteriak. Aksen oranye muncul di momen kunci.
- RHYTHM 2: konsisten dengan beberapa jeda. Login punya komposisi split yang berbeda dari dashboard shell.
- MOTION 1: hover dan transisi state saja. Tidak ada loop tanpa henti, tidak ada parallax.

## Surface archetypes (per layar)

- **Login:** Configure. User sedang menyiapkan akses. Dekorasi rendah, state validasi jelas, satu fokus.
- **Dashboard:** Monitor. User memantau state. Kepadatan dan hierarki sekali-pandang menang atas dekorasi.

## Non-negotiables

- Tanpa emoji di teks UI. Ikon SVG bila perlu, dengan alasan (R-04).
- Semua fitur tetap ada. Perubahan dibatasi ke lapisan tampilan (UI, GUI, UX).
- Kontras teks memenuhi WCAG AA (R-25).
- Setiap kontrol punya perilaku nyata (R-26).
