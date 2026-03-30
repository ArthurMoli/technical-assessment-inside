import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import { ArrowUpDown, Inbox } from "lucide-react";
import { apiFetch } from "../lib/api.server";

interface Transaction {
  id: string;
  type: "deposit" | "withdraw" | "transfer";
  amount: number;
  timestamp: string;
  user_id: string | null;
  from_user_id: string | null;
  to_user_id: string | null;
  status: string;
  processed_at: string;
}

interface TransactionList { items: Transaction[]; total: number; }
interface Summary {
  total_deposits: number; total_withdrawals: number; total_transfers: number;
  deposit_count: number; withdrawal_count: number; transfer_count: number;
}
interface User { id: string; name: string; account_number: string; }

export async function loader() {
  const [txData, summary, users] = await Promise.all([
    apiFetch<TransactionList>("/transactions?limit=100"),
    apiFetch<Summary>("/transactions/summary"),
    apiFetch<User[]>("/users"),
  ]);
  const userMap: Record<string, User> = {};
  for (const u of users) userMap[u.id] = u;
  return json({ transactions: txData.items, total: txData.total, summary, userMap });
}

function fmt(v: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v); }
function fmtDate(ts: string) { return new Date(ts).toLocaleString("pt-BR"); }
function getUserLabel(map: Record<string, User>, id: string | null) {
  if (!id) return "—";
  const u = map[id];
  return u ? `${u.name} (${u.account_number})` : id.substring(0, 12) + "...";
}
function typeLabel(t: string) {
  return t === "deposit" ? "Depósito" : t === "withdraw" ? "Saque" : "Transferência";
}

export default function AdminTransactions() {
  const { transactions, total, summary, userMap } = useLoaderData<typeof loader>();
  const [sel, setSel] = useState<(typeof transactions)[0] | null>(null);

  return (
    <div>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-value deposit">{fmt(summary.total_deposits)}</div>
          <div className="summary-label">Depósitos ({summary.deposit_count})</div>
        </div>
        <div className="summary-card">
          <div className="summary-value withdraw">{fmt(summary.total_withdrawals)}</div>
          <div className="summary-label">Saques ({summary.withdrawal_count})</div>
        </div>
        <div className="summary-card">
          <div className="summary-value transfer">{fmt(summary.total_transfers)}</div>
          <div className="summary-label">Transferências ({summary.transfer_count})</div>
        </div>
        <div className="summary-card">
          <div className="summary-value">{total}</div>
          <div className="summary-label">Total</div>
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="empty-state"><Inbox size={40} /><span>Nenhuma transação processada.</span></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Data</th><th>ID</th><th>Tipo</th><th>Valor</th><th>Usuário</th></tr></thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="clickable-row" onClick={() => setSel(tx)}>
                  <td>{fmtDate(tx.timestamp)}</td>
                  <td className="mono">{tx.id.substring(0, 14)}...</td>
                  <td><span className={`badge badge-${tx.type}`}>{tx.type}</span></td>
                  <td style={{ fontVariantNumeric: "tabular-nums" }}>{fmt(tx.amount)}</td>
                  <td style={{ fontSize: "0.82rem" }}>
                    {tx.type === "transfer"
                      ? `${userMap[tx.from_user_id!]?.name || "?"} → ${userMap[tx.to_user_id!]?.name || "?"}`
                      : getUserLabel(userMap, tx.user_id)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sel && (
        <div className="modal-overlay" onClick={() => setSel(null)}>
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalhes da Transação</h3>
              <button className="modal-close" onClick={() => setSel(null)}>&times;</button>
            </div>
            <div className="detail-hero">
              <span className={`badge badge-${sel.type}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}>
                {typeLabel(sel.type)}
              </span>
              <span className="detail-hero-amount">{fmt(sel.amount)}</span>
            </div>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">ID da Transação</span>
                <span className="detail-value mono">{sel.id}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">
                  <span className={`badge ${sel.status === "processed" ? "badge-deposit" : "badge-withdraw"}`}>
                    {sel.status === "processed" ? "Processada" : "Falhou"}
                  </span>
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Data da Transação</span>
                <span className="detail-value">{fmtDate(sel.timestamp)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Processada em</span>
                <span className="detail-value">{fmtDate(sel.processed_at)}</span>
              </div>
            </div>
            <hr className="detail-divider" />
            {(sel.type === "deposit" || sel.type === "withdraw") && (
              <div className="detail-grid">
                <div className="detail-item full-width">
                  <span className="detail-label">Usuário</span>
                  <span className="detail-value">{getUserLabel(userMap, sel.user_id)}</span>
                </div>
              </div>
            )}
            {sel.type === "transfer" && (
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">Remetente</span>
                  <span className="detail-value">{getUserLabel(userMap, sel.from_user_id)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Destinatário</span>
                  <span className="detail-value">{getUserLabel(userMap, sel.to_user_id)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
