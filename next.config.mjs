/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Keep the document-extraction libraries out of the webpack bundle; they load
    // their own assets at runtime and only ever run server-side.
    serverComponentsExternalPackages: ["pdf-parse", "mammoth", "pg", "mysql2"],
  },
};

export default nextConfig;
