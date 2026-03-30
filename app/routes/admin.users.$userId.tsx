import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { ArrowLeft, ArrowUpDown, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { apiFetch } from "../lib/api.server";

interface User { id: string; name: string; email: string; account_number: string; balance: number; }
interface Transaction {
  id: string; type: "deposit" | "withdraw" | "transfer"; amount: number;
  timestamp: string; user_id: string | null; from_user_id: string | null; to_user_id: string | null;
}

export async function loader({ params }: LoaderFunctionArgs) {
  const [user, transactions] = await Promise.all([
    apiFetch<User>(`/users/${params.userId}`),
    apiFetch<Transaction[]>(`/transactions/user/${params.userId}`),
  ]);
  return json({ user, transactions });
}

function fmt(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); }
function fmtDate(ts: string) { return new Date(ts).toLocaleString("pt-BR"); }
function getInitials(name: string) { return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase(); }

export default function AdminUserDetail() {
  const { user, transactions } = useLoaderData<typeof loader>();

  return (
    <div>
      <Link to="/admin" className="back-link"><ArrowLeft size={14} /> Voltar</Link>

      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem" }}>
        <div className="avatar" style={{ width: 52, height: 52, fontSize: "1rem" }}>{getInitials(user.name)}</div>
        <div>
          <div style={{ fontSize: "1.2rem", fontWeight: 700 }}>{user.name}</div>
          <div style={{ fontSize: "0.85rem", color: "var(--gray-500)" }}>{user.email} &middot; Conta {user.account_number}</div>
        </div>
        <div style={{ marginLeft: "auto", textAlign: "right" }}>
          <div style={{ fontSize: "0.7rem", color: "var(--gray-400)", textTransform: "uppercase", fontWeight: 600, letterSpacing: "0.05em" }}>Saldo</div>
          <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--success)", fontVariantNumeric: "tabular-nums" }}>{fmt(user.balance)}</div>
        </div>
      </div>

      <h3 className="section-title"><ArrowUpDown size={18} /> Extrato ({transactions.length})</h3>

      {transactions.length === 0 ? (
        <div className="empty-state"><ArrowUpDown size={40} /><span>Nenhuma movimentação.</span></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Detalhes</th></tr></thead>
            <tbody>
              {transactions.map((tx) => {
                const isCredit = tx.type === "deposit" || (tx.type === "transfer" && tx.to_user_id === user.id);
                return (
                  <tr key={tx.id}>
                    <td>{fmtDate(tx.timestamp)}</td>
                    <td><span className={`badge badge-${tx.type}`}>{tx.type}</span></td>
                    <td className={isCredit ? "amount-positive" : "amount-negative"}>
                      {isCredit ? "+" : "-"}{fmt(tx.amount)}
                    </td>
                    <td>
                      {tx.type === "transfer" && tx.from_user_id === user.id && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ArrowUpRight size={14} /> Enviado</span>
                      )}
                      {tx.type === "transfer" && tx.to_user_id === user.id && (
                        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><ArrowDownLeft size={14} /> Recebido</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
