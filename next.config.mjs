/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compress: true,
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "react-icons",
      "date-fns",
      "framer-motion",
      "recharts",
      "@radix-ui/react-icons",
    ],
  },
  images: {
    domains: ["assets.co.dev", "images.unsplash.com"],
  },
  webpack: (config) => {
    config.optimization.minimize = process.env.NEXT_PUBLIC_CO_DEV_ENV !== "preview";
    return config;
  },
};

export default nextConfig;
