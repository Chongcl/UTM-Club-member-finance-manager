import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ClubSync — Campus Club Operations Portal',
    short_name: 'ClubSync',
    description:
      'All-in-one student club activities, QR attendance, fee collection, equipment borrowing, and financial ledger.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4fbf7',
    theme_color: '#059669',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
