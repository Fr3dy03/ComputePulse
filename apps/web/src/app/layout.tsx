import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'ComputePulse — cross-network provider observability',
    template: '%s · ComputePulse',
  },
  description:
    'Monitor provider health, compare network signals and investigate infrastructure incidents through one transparent operations view.',
  applicationName: 'ComputePulse',
  openGraph: {
    title: 'ComputePulse — cross-network provider observability',
    description:
      'See the infrastructure behind decentralised compute. Explicit evidence, freshness and provenance for every signal.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#11171D',
  colorScheme: 'dark',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
