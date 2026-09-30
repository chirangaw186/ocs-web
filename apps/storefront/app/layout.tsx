import type { Metadata } from "next";
import { Cormorant_Garamond, Jost, Pinyon_Script } from "next/font/google";
import Link from "next/link";
import { CartLink } from "@/components/CartLink";
import { MenuIcon } from "@/components/Icons";
import "./globals.css";

// Self-hosted at build time, so the static export needs no font requests to Google.
const serif = Cormorant_Garamond({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-serif", display: "swap" });
const sans = Jost({ subsets: ["latin"], weight: ["300", "400", "500"], variable: "--font-sans", display: "swap" });
const script = Pinyon_Script({ subsets: ["latin"], weight: "400", variable: "--font-script", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pavielle — Timeless elegance. Softly yours.", template: "%s · Pavielle" },
  description: "Elegant women's clothing in soft pastel colours. Made in Sri Lanka.",
};

const NAV = [
  { href: "/#new-in", label: "New in" },
  { href: "/#fabrics", label: "Fabrics" },
  { href: "/#help", label: "Help" },
];

function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${script.variable}`}>
      <body>
        <div className="announce">Cash on delivery · Card payments via PayHere · Made in Sri Lanka</div>
        <header className="site">
          <div className="container">
            <Nav />
            <details className="menu">
              <summary aria-label="Menu"><MenuIcon /></summary>
              <Nav />
            </details>
            <Link href="/" className="brand">PAVIELLE</Link>
            <div className="site-actions"><CartLink /></div>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site">
          <div className="container">
            <div className="footer-cols">
              <div>
                <div className="footer-brand">PAVIELLE</div>
                <div className="footer-tag">Timeless elegance. Softly yours.</div>
              </div>
              <div>
                <div className="footer-tag">Shop</div>
                <Link href="/#new-in">New in</Link>
                <Link href="/#fabrics">Shop by fabric</Link>
                <Link href="/cart/">Your bag</Link>
              </div>
              <div>
                <div className="footer-tag">Help</div>
                <Link href="/#help">Size chart</Link>
                <Link href="/#help">Delivery &amp; returns</Link>
                <Link href="/#help">Fabric care</Link>
              </div>
            </div>
            <div className="footer-base">
              <span>© {new Date().getFullYear()} Pavielle · Made in Sri Lanka</span>
              <span>Island-wide delivery · Pay by card via PayHere, or cash on delivery</span>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
