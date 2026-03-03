import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'USPS WO Tracker',
    short_name: 'USPS Tracker',
    description: 'A robust work order tracking app for managing and streamlining tasks for USPS.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#B63128',
    icons: [
      {
        src: 'https://firebasestudio.app/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
    ],
  }
}
