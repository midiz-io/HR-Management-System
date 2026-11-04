import "../styles/globals.css"

export const metadata = {
  title: 'Master Controller',
  description: 'Mobile App Master Controller Dashboard',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background font-sans antialiased">{children}</body>
    </html>
  )
}
