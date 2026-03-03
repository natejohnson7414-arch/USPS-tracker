import type { NextConfig } from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /\/_next\/static\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'next-static-assets',
        expiration: {
          maxEntries: 128,
          maxAgeSeconds: 24 * 60 * 60 * 30, // 30 days
        },
      },
    },
    {
      urlPattern: /\/_next\/image\?url=.*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-image-assets',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 * 7, // 7 days
        },
      },
    },
    {
      urlPattern: /.*(_rsc|__flight__).*/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-rsc-payloads',
        expiration: {
          maxEntries: 256,
          maxAgeSeconds: 24 * 60 * 60 * 1, // 1 day
        },
      },
    },
    {
      urlPattern: /\/.*$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'next-pages',
        expiration: {
          maxEntries: 64,
          maxAgeSeconds: 24 * 60 * 60 * 7, // 7 days
        },
      },
    },
    {
      urlPattern: /\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-responses',
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const nextConfig: NextConfig = {
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
