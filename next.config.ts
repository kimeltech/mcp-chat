import type { NextConfig } from "next";
// import { withBotId } from "botid/next/config";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Disable Turbopack to use webpack (which handles pg externals properly)
  // You can enable it for dev: pnpm dev (without --turbopack flag)
  
  // Configure webpack to externalize node-postgres for server-side only
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pg and related modules for server-side
      config.externals = config.externals || [];
      config.externals.push({
        'pg': 'commonjs pg',
        'pg-native': 'commonjs pg-native',
      });
    }
    return config;
  },
  
  // Mark packages as server-only to prevent client bundling
  serverExternalPackages: ['pg', 'pg-pool', 'pg-native'],
};

export default nextConfig;
// export default withBotId(nextConfig);
