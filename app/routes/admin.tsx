import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { Outlet, Link, useLocation, Form, useLoaderData } from "@remix-run/react";
import { Landmark, LogOut, Users, ArrowUpDown, AlertTriangle, PlusCircle } from "lucide-react";
import { requireAdmin } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireAdmin(request);
  return json({ user });
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  const location = useLocation();

  const tabs = [
    { to: "/admin", label: "Usuários", icon: Users, end: true },
    { to: "/admin/transactions", label: "Transações", icon: ArrowUpDown },
    { to: "/admin/invalid", label: "Inválidas", icon: AlertTriangle },
    { to: "/admin/operations", label: "Operações", icon: PlusCircle },
  ];

  return (
    <>
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo"><Landmark size={18} /></div>
          <span className="topbar-name">ArthurBank</span>
          <span style={{ fontSize: "0.7rem", background: "var(--primary-light)", color: "var(--primary)", padding: "0.15rem 0.5rem", borderRadius: 4, fontWeight: 600, marginLeft: 4 }}>ADMIN</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="topbar-avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
          <Form method="post" action="/logout">
            <button type="submit" className="btn-secondary"><LogOut size={14} /> Sair</button>
          </Form>
        </div>
      </div>

      <div className="main-content">
        <div className="admin-tabs">
          {tabs.map((tab) => {
            const isActive = tab.end
              ? location.pathname === tab.to
              : location.pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link key={tab.to} to={tab.to} className={`admin-tab ${isActive ? "active" : ""}`}>
                <Icon size={15} /> {tab.label}
              </Link>
            );
          })}
        </div>
        <Outlet />
      </div>
    </>
  );
}
