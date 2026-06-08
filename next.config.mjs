/** @type {import('next').NextConfig} */
const nextConfig = {
  // Uploads can be a few MB (PDF/JPG/PNG). Allow a generous body size for
  // the Server Action / route handler that receives the file.
  experimental: {
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
