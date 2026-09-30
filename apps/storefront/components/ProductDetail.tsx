"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatLkr, type StoreProduct } from "@pavielle/shared";
import { PUBLIC_API } from "@/lib/api";
import { cart } from "@/lib/cart";
import { colourHex, uniqueColours } from "@/lib/colours";

/** Gallery plus colour/size selection with live stock (the page itself is static). */
export function ProductDetail({ product }: { product: StoreProduct }) {
  const colours = useMemo(() => uniqueColours(product.variants), [product]);
  const [colour, setColour] = useState(colours[0]!);
  const [size, setSize] = useState<string>();
  const [stock, setStock] = useState<Record<string, number>>(
    Object.fromEntries(product.variants.map((v) => [v.sku, v.available])),
  );
  const [added, setAdded] = useState(false);
  const [needSize, setNeedSize] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);

  useEffect(() => {
    const skus = product.variants.map((v) => v.sku).join(",");
    fetch(`${PUBLIC_API}/store/availability?skus=${encodeURIComponent(skus)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => s && setStock(s))
      .catch(() => { /* keep build-time numbers */ });
  }, [product]);

  // Product cards link with ?colour=… so the chosen colourway opens preselected.
  useEffect(() => {
    const wanted = new URLSearchParams(window.location.search).get("colour");
    if (wanted && colours.includes(wanted)) setColour(wanted);
  }, [colours]);

  const forColour = product.variants.filter((v) => v.colour === colour);
  const selected = forColour.find((v) => v.size === size);
  const left = selected ? stock[selected.sku] ?? 0 : 0;
  const image = product.images[imageIndex] ?? product.images[0];
  const fabric = product.fabric?.split(",")[0];

  return (
    <div className="pdp">
      <div className="gallery">
        {product.images.length > 1 && (
          <div className="thumbs">
            {product.images.map((img, i) => (
              <button key={img.url} type="button" className="thumb" aria-pressed={i === imageIndex} aria-label={`Photo ${i + 1}`}
                onClick={() => setImageIndex(i)}>
                <img src={img.url} alt="" />
              </button>
            ))}
          </div>
        )}
        <div className="tile" style={{ background: colourHex(colour) }}>
          {image ? <img src={image.url} alt={image.alt} /> : <span className="mark" aria-hidden="true">P</span>}
        </div>
      </div>

      <div className="info">
        <div className="info-head">
          {fabric && <div className="eyebrow">{fabric}</div>}
          <h1>{product.name}</h1>
          <div className="price">{formatLkr(selected?.price ?? forColour[0]!.price)}</div>
        </div>

        <div className="field">
          <div className="field-label"><span>Colour · <strong>{colour}</strong></span></div>
          <div className="swatches">
            {colours.map((c) => {
              const hex = colourHex(c);
              const pick = () => { setColour(c); setSize(undefined); setAdded(false); };
              return hex
                ? <button key={c} type="button" className="swatch" style={{ background: hex }} aria-label={c} title={c} aria-pressed={c === colour} onClick={pick} />
                : <button key={c} type="button" className="chip" aria-pressed={c === colour} onClick={pick}>{c}</button>;
            })}
          </div>
        </div>

        <div className="field">
          <div className="field-label"><span>Size</span><Link href="/#help">Size chart</Link></div>
          <div className="sizes">
            {forColour.map((v) => (
              <button key={v.sku} type="button" className="chip" aria-pressed={v.size === size} disabled={(stock[v.sku] ?? 0) <= 0}
                onClick={() => { setSize(v.size); setAdded(false); setNeedSize(false); }}>{v.size}</button>
            ))}
          </div>
          {selected && left > 0 && left <= 2 && <div className="stock low">Only {left} left in {selected.size}</div>}
          {selected && left > 2 && <div className="stock">In stock in {selected.size}</div>}
          {needSize && !selected && <div className="error" role="alert">Please choose a size.</div>}
        </div>

        <div className="buy">
          <button type="button" className="btn btn-block"
            onClick={() => {
              if (!selected) { setNeedSize(true); return; }
              cart.add({ sku: selected.sku, name: product.name, colour: selected.colour, size: selected.size, price: selected.price, quantity: 1, slug: product.slug });
              setAdded(true);
            }}>
            {added ? "Added to bag" : "Add to bag"}
          </button>
          {added && selected && (
            <div className="added" role="status">
              <span>Added: {product.name}, {selected.colour}, {selected.size}</span>
              <Link href="/cart/">View bag</Link>
            </div>
          )}
          <div className="note">Pay by card via PayHere, or cash on delivery.</div>
        </div>

        <div className="acc">
          <details open>
            <summary>Description</summary>
            <p>{product.description}</p>
          </details>
          {(product.fabric || product.care) && (
            <details>
              <summary>Fabric &amp; care</summary>
              <p>{[product.fabric, product.care].filter(Boolean).join(". ")}</p>
            </details>
          )}
          <details>
            <summary>Delivery</summary>
            <p>Island-wide delivery. The delivery fee, if any, is shown in your bag before you pay.</p>
          </details>
        </div>
      </div>
    </div>
  );
}
