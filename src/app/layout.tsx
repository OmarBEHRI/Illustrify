import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Illustrify - Text to Video',
  description: 'Generate beautiful videos from stories, PDFs, or YouTube links with a fluid glass UI.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="fixed inset-0 -z-10" aria-hidden>
          <div className="absolute inset-0 opacity-70" />
        </div>
        {children}
      </body>
    </html>
  );
}


