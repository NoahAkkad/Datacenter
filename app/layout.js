import './globals.css';

export const metadata = {
  title: 'Data Center Management',
  description: 'Enterprise-grade data center management interface'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
