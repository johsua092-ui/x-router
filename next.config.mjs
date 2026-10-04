/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // docker/standalone deployment
  output: "standalone",
};

export default nextConfig;
