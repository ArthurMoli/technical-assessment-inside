import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowRight } from "lucide-react";
import { apiFetch } from "../lib/api.server";

interface User {
  id: string;
  name: string;
  email: string;
  account_number: string;
  balance: number;
}

export async function loader() {
  const users = await apiFetch<User[]>("/users");
  return json({ users });
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

export default function AdminUsers() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="card-grid">
        {users.map((user) => (
          <div key={user.id} className="card">
            <div className="card-top">
              <div className="avatar">{getInitials(user.name)}</div>
              <div className="card-info">
                <div className="card-title">{user.name}</div>
                <div className="card-subtitle">{user.email}</div>
              </div>
            </div>
            <div className="card-subtitle" style={{ marginBottom: 4 }}>Conta: {user.account_number}</div>
            <div className="card-balance">{fmt(user.balance)}</div>
            <Link to={`/admin/users/${user.id}`} className="card-link">
              Ver extrato <ArrowRight size={13} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
