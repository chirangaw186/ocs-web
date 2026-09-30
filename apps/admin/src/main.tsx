import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, NavLink, Outlet, RouterProvider, useNavigate } from "react-router";
import { useEffect } from "react";
import { logout, userManager } from "./auth";
import { OrdersPage } from "./pages/Orders";
import { OrderDetailPage } from "./pages/OrderDetail";
import { InventoryPage } from "./pages/Inventory";
import { ProductsPage } from "./pages/Products";
import "./styles.css";

function Layout() {
  return (
    <div className="shell">
      <nav>
        <strong>PAVIELLE</strong>
        <NavLink to="/">Orders</NavLink>
        <NavLink to="/inventory">Inventory</NavLink>
        <NavLink to="/products">Products</NavLink>
        {userManager && <button onClick={logout}>Sign out</button>}
      </nav>
      <main><Outlet /></main>
    </div>
  );
}

function Callback() {
  const navigate = useNavigate();
  useEffect(() => { userManager?.signinRedirectCallback().then(() => navigate("/")); }, [navigate]);
  return <p>Signing in…</p>;
}

const router = createBrowserRouter([
  { path: "/callback", element: <Callback /> },
  {
    element: <Layout />,
    children: [
      { path: "/", element: <OrdersPage /> },
      { path: "/orders/:id", element: <OrderDetailPage /> },
      { path: "/inventory", element: <InventoryPage /> },
      { path: "/products", element: <ProductsPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
