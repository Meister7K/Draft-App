import './globals.css'
import { Inter } from 'next/font/google'
import { DataProvider } from './DataContext';

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Sleeper Draft Analyzer',
  description: 'Analyze your Sleeper fantasy football draft picks',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className + " bg-[var(--background)] text-[var(--foreground)] min-h-screen"}>
        <DataProvider>
          {children}
        </DataProvider>
      </body>
    </html>
  )
}