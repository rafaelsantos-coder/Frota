/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@frota/shared"],
  output: "standalone",
};

export default nextConfig;
