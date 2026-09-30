import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getProducts } from "@/lib/api";
import { uniqueColours } from "@/lib/colours";
import { ProductCard } from "@/components/ProductCard";
import { ProductDetail } from "@/components/ProductDetail";

export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  return p ? { title: p.name, description: p.description, openGraph: { images: p.images.map((i) => i.url) } } : {};
}

export default async function ProductPage({ params }: Props) {
  const product = await getProduct((await params).slug);
  if (!product) notFound();
  const others = (await getProducts()).filter((p) => p.slug !== product.slug);
  return (
    <div className="container pdp-wrap">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span aria-hidden="true">/</span>
        <Link href="/#new-in">New in</Link><span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>
      <ProductDetail product={product} />
      {others.length > 0 && (
        <section className="related">
          <div className="rule-title"><h2>Also in the pastel edit</h2></div>
          <div className="grid">
            {others.flatMap((p) => uniqueColours(p.variants).map((c) => <ProductCard key={`${p.slug}-${c}`} product={p} colour={c} />)).slice(0, 4)}
          </div>
        </section>
      )}
    </div>
  );
}
