export const metadata = {
  title: 'BillFlow API Service',
  description: 'Backend Next.js API Service for BillFlow',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#0a0e1a', color: '#f8fafc' }}>
        {children}
      </body>
    </html>
  );
}
