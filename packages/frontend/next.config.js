/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        // Match any route that is just a short code (letters, numbers, hyphens)
        // This prevents rewriting paths like /dashboard or /login
        source: '/:code([a-zA-Z0-9-]+)',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/:code`,
      },
    ];
  },
};

module.exports = nextConfig;
