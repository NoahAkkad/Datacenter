import './globals.css';
import { AuthProvider } from '../components/AuthProvider';

export const metadata = {
  title: 'Data Center Management',
  description: 'Enterprise-grade data center management interface'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
