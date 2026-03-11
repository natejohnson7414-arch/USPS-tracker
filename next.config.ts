import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  // Navigation fallback ensures that when offline, hard navigations 
  // (mode: 'navigate') return the index page shell.
  fallbacks: {
    document: '/', 
  },
  runtimeCaching: [
    {
      // 1. Navigation Requests (The "App Shell" strategy)
      urlPattern: ({ request }) => request.mode === 'navigate',
      handler: 'NetworkFirst',
      options: {
        cacheName: 'pages',
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 16,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      // 2. Next.js Static Assets (Chunks, CSS)
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
        },
      },
    },
    {
      // 3. Next.js Images
      urlPattern: /\/_next\/image\?url=.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image-assets',
        expiration: {
          maxEntries: 32,
          maxAgeSeconds: 24 * 60 * 60 * 7, // 7 days
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'firebasestudio.app' },
      { protocol: 'https', hostname: 'www.crawford-company.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' }
    ],
  },
};

export default withPWA(nextConfig);
