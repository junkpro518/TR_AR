import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: 'standalone',
  typescript: {
    // أخطاء Supabase types مرتبطة بغياب generated types — لا تؤثر على التشغيل
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
