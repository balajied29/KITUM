import '../styles/globals.css';
import BottomNav from '@/components/BottomNav';
import LocationModal from '@/components/LocationModal';

export const metadata = {
  title: 'KIT UM — Water delivered to your door',
  description: 'Slot-based water delivery for homes and shops in Shillong. UPI & COD.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'KIT UM',
  },
  icons: {
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport = {
  themeColor: '#1d4ed8',
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
        <meta name="apple-mobile-web-app-title" content="KIT UM" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans antialiased bg-white text-text-main">
        <div className="max-w-lg mx-auto min-h-dvh pb-14">
          {children}
        </div>
        <LocationModal />
        <BottomNav />
      </body>
    </html>
  );
}
