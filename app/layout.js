import './globals.css';

export const metadata = {
  title: 'Data Center Management',
  description: 'Simple data center management system'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
