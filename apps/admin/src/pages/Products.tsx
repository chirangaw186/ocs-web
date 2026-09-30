import { useState } from "react";
import { rs } from "@pavielle/shared";
import { api } from "../api";
import { useApi } from "../useApi";

interface Product { id: string; slug: string; styleCode: string; name: string; status: string }

export function ProductsPage() {
  const { data, error, reload } = useApi<Product[]>("/products");
  const [msg, setMsg] = useState<string>();

  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const colours = f.colours!.split(",").map((c) => c.trim()).filter(Boolean);   // "Blush:BLS, Ivory:IVY"
    const sizes = f.sizes!.split(",").map((s) => s.trim()).filter(Boolean);
    const variants = colours.flatMap((c) => {
      const [colour, code] = c.split(":").map((x) => x.trim());
      return sizes.map((size) => ({ sku: `${f.styleCode}-${code}-${size}`, colour: colour!, size, price: rs(Number(f.price)) }));
    });
    try {
      await api("/products", { method: "POST", body: {
        slug: f.slug, styleCode: f.styleCode, name: f.name, description: f.description, fabric: f.fabric || undefined,
        care: f.care || undefined, status: f.status, variants,
        images: f.image ? [{ url: f.image, alt: f.name }] : [],
      } });
      setMsg(`Created with ${variants.length} SKUs`); reload(); e.currentTarget.reset();
    } catch (err) { setMsg((err as Error).message); }
  }

  async function setStatus(p: Product, status: string) {
    await api(`/products/${p.id}`, { method: "PATCH", body: { status } }).then(reload, (e: Error) => setMsg(e.message));
  }

  return (
    <>
      <h1>Products</h1>
      {error && <p className="error">{error}</p>}
      <table>
        <thead><tr><th>Style</th><th>Name</th><th>Status</th><th /></tr></thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.id}>
              <td>{p.styleCode}</td><td>{p.name}</td><td>{p.status}</td>
              <td>{p.status !== "ACTIVE"
                ? <button onClick={() => setStatus(p, "ACTIVE")}>Publish</button>
                : <button onClick={() => setStatus(p, "ARCHIVED")}>Archive</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>New product</h2>
      <form onSubmit={create} style={{ display: "grid", gap: 8, maxWidth: 480 }}>
        <input name="name" placeholder="Name (Soft Midi Dress)" required />
        <input name="slug" placeholder="URL slug (soft-midi-dress)" required pattern="[a-z0-9-]+" />
        <input name="styleCode" placeholder="Style code (PV-SMD-01)" required />
        <input name="price" type="number" placeholder="Price in rupees (11900)" required />
        <input name="colours" placeholder="Colours as Name:CODE (Blush:BLS, Ivory:IVY)" required />
        <input name="sizes" defaultValue="XS,S,M,L,XL" required />
        <input name="fabric" placeholder="Fabric" />
        <input name="care" placeholder="Care" />
        <input name="image" type="url" placeholder="Main image URL" />
        <input name="description" placeholder="Description" />
        <select name="status" defaultValue="DRAFT"><option>DRAFT</option><option>ACTIVE</option></select>
        <button className="primary">Create</button>
        {msg && <span>{msg}</span>}
      </form>
    </>
  );
}
