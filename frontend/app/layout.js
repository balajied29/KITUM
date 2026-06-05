import '../styles/globals.css';
import AppFrame from '@/components/AppFrame';

export const metadata = {
  title: 'KitUm — Water delivered to your door',
  description: 'Slot-based water delivery for homes and shops in Shillong. UPI & COD.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KitUm',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport = {
  themeColor: '#263cf2',
  width: 'device-width',
  initialScale: 1,
  minimumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="KitUm" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans antialiased bg-[#e6e8ef] text-text-main">
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
