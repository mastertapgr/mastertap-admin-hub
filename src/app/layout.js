export const metadata = {
  title: 'MasterTap Admin Hub',
  description: 'Communication Hub for Telegram Notifications',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  )
}
