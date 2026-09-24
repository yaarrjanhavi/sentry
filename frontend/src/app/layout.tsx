import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sentry — Self-Learning Code Review Agent',
  description: 'AI code review agent that learns which categories of issues matter to a specific repo based on human accept/dismiss feedback.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Teko:wght@500;600;700&family=Urbanist:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-black text-white antialiased min-h-screen flex flex-col selection:bg-[#3dff6b] selection:text-black">
        {children}
      </body>
    </html>
  );
}
