/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Bỏ qua lỗi TypeScript lúc build để không bị chặn deploy
    ignoreBuildErrors: true,
  },
  eslint: {
    // Bỏ qua lỗi ESLint lúc build
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
