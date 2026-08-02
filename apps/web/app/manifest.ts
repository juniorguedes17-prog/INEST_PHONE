import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'iNest Phone',
    short_name: 'iNest',
    description: 'Plataforma comercial iNest Phone.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f4f7fb',
    theme_color: '#5f7cff',
    icons: [
      {
        src: '/brand/inest-phone-logo.png',
        sizes: '1200x1200',
        type: 'image/png',
      },
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
