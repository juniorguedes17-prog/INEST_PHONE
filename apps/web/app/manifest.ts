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
        src: '/brand/inest-phone-logo.jpg',
        sizes: 'any',
        type: 'image/jpeg',
      },
    ],
  };
}
