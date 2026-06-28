/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Allow remote images (restaurant logos, product photos) from common hosts.
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  experimental: {
    // bcryptjs / prisma stay on the Node runtime; nothing edge-only here.
  },
};

export default nextConfig;
