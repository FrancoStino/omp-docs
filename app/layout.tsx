import type {Metadata} from "next";
import {Geist, JetBrains_Mono} from "next/font/google";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        template: '%s | OMP Docs',
        default: 'OMP Docs',
    },
    description: 'Always up-to-date documentation for omp (oh-my-pi).',
};

export default function RootLayout({children}: LayoutProps<"/">) {
    return (
        <html
            lang="en"
            className={`${geistSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
            suppressHydrationWarning
        >
        <body className="min-h-full flex flex-col">{children}</body>
        </html>
    );
}
