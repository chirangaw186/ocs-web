import Link from "next/link";
import { formatLkr, type StoreProduct } from "@pavielle/shared";
import { colourHex, uniqueColours } from "@/lib/colours";

/** One card per colourway: the tile is tinted with the fabric colour until a photo exists. */
export function ProductCard({ product, colour }: { product: StoreProduct; colour: string }) {
  const image = product.images[0];
  const price = Math.min(...product.variants.filter((v) => v.colour === colour).map((v) => v.price));
  const fabric = product.fabric?.split(",")[0];
  return (
    <Link href={`/products/${product.slug}/?colour=${encodeURIComponent(colour)}`} className="card">
      <div className="tile" style={{ background: colourHex(colour) }}>
        {image ? <img src={image.url} alt={image.alt} loading="lazy" /> : <span className="mark" aria-hidden="true">P</span>}
      </div>
      <div className="card-meta">
        <div className="card-row">
          <span className="card-name">{product.name}</span>
          <span className="price">{formatLkr(price)}</span>
        </div>
        <div className="card-sub">{fabric ? `${fabric} · ${colour}` : colour}</div>
        <div className="dots" aria-hidden="true">
          {uniqueColours(product.variants).map((c) => (
            <span key={c} className={c === colour ? "dot on" : "dot"} style={{ background: colourHex(c) }} />
          ))}
        </div>
      </div>
    </Link>
  );
}
