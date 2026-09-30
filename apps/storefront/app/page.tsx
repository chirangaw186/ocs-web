import Link from "next/link";
import { getProducts } from "@/lib/api";
import { colourHex, uniqueColours } from "@/lib/colours";
import { ProductCard } from "@/components/ProductCard";
import { DressFormIcon, HangerIcon, LeafIcon, SparkleIcon } from "@/components/Icons";

/** Fabrics we describe on the home page; a card only shows when the catalogue has a matching product. */
const FABRICS = [
  { key: "crepe", name: "Crepe", tag: "Matte · weighted", sheer: false },
  { key: "georgette", name: "Georgette", tag: "Sheer · flowing", sheer: true },
];

export default async function Home() {
  const products = await getProducts();
  const fabrics = FABRICS.flatMap((f) => {
    const matches = products.filter((p) => p.fabric?.toLowerCase().includes(f.key));
    return matches[0] ? [{ ...f, product: matches[0], colours: uniqueColours(matches.flatMap((p) => p.variants)) }] : [];
  });

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="script">Softly yours.</div>
          <div className="eyebrow">The pastel edit</div>
          <h1>Timeless elegance, cut in soft crepe and georgette.</h1>
          <p className="lead">Midi dresses and flowing maxis in blush, ivory, powder blue and sage. Made in Sri Lanka.</p>
          <div className="hero-actions">
            <Link href="/#new-in" className="btn">Shop new in</Link>
            <Link href="/#help" className="btn btn-outline">Find your size</Link>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true"><span>P</span></div>
      </section>

      <section className="values" aria-label="What Pavielle stands for">
        <div><DressFormIcon /><span>Elegant</span></div>
        <div><LeafIcon /><span>Feminine</span></div>
        <div><SparkleIcon /><span>Timeless</span></div>
        <div><HangerIcon /><span>Effortless</span></div>
      </section>

      <section id="new-in" className="container section">
        <div className="section-head"><h2>New in</h2></div>
        <div className="grid">
          {products.flatMap((p) => uniqueColours(p.variants).map((c) => <ProductCard key={`${p.slug}-${c}`} product={p} colour={c} />))}
        </div>
      </section>

      {fabrics.length > 0 && (
        <section id="fabrics" className="container section">
          <div className="section-center">
            <h2 className="section-title">Shop by fabric</h2>
            <div className="ornament" aria-hidden="true"><i /></div>
          </div>
          <div className="fabrics">
            {fabrics.map((f) => (
              <div key={f.key} className="fabric-card">
                <div className="fabric-copy">
                  <div className="eyebrow">{f.tag}</div>
                  <h3>{f.name}</h3>
                  <p>{f.product.fabric}.</p>
                  {f.product.care && <p>Care: {f.product.care}</p>}
                  <Link href={`/products/${f.product.slug}/`} className="caps">Shop {f.name}</Link>
                </div>
                <div className={f.sheer ? "fabric-swatches sheer" : "fabric-swatches"} aria-hidden="true">
                  {f.colours.map((c) => <span key={c} style={{ background: colourHex(c) }} />)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="help" className="container help">
        <div>
          <h3>Size chart</h3>
          <p>Bust, waist and hip measurements for XS to XL.</p>
          <span className="eyebrow">Coming soon</span>
        </div>
        <div>
          <h3>Delivery &amp; returns</h3>
          <p>Island-wide delivery. Pay by card via PayHere, or cash on delivery.</p>
          <span className="eyebrow">Full policy coming soon</span>
        </div>
        <div>
          <h3>Fabric care</h3>
          <p>How to keep crepe and georgette looking new.</p>
          <span className="eyebrow">Coming soon</span>
        </div>
      </section>
    </>
  );
}
