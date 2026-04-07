const { readFileSync } = require('fs');
const { resolve } = require('path');

/**
 * F24: Environment variable validation at build time
 * Validates required environment variables are set before building the app
 */
function validateEnvVars() {
  const errors = [];

  // List of required public environment variables (NEXT_PUBLIC_*)
  // NOTE: Only NEXT_PUBLIC_* vars are included in client bundle
  // Backend URL and API keys should be handled server-side only

  // Currently no required public env vars, but framework is in place for future

  if (errors.length > 0) {
    console.error('Environment validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  }
}

// Run validation at build time
if (process.env.NODE_ENV === 'production') {
  validateEnvVars();
}

// Leer version desde el archivo VERSION en la raiz del proyecto
let appVersion = '0.0.0';
try {
  appVersion = readFileSync(resolve(__dirname, '../VERSION'), 'utf-8').trim();
} catch {
  // Fallback si el archivo no existe (ej: dentro del contenedor Docker)
  appVersion = process.env.APP_VERSION || '0.0.0';
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    // Disable Next.js image optimization — images are served directly by nginx
    // and TMDB. Optimization fails in Docker because the frontend container
    // cannot reach /media/ paths (served by nginx) or may lack memory/network
    // to proxy external images.
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

module.exports = nextConfig;
