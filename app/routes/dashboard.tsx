import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Landmark, LogOut, Wallet, ArrowUpDown, SendHorizontal,
  AlertCircle, CheckCircle, XCircle, CreditCard, ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import { requireUser } from "../lib/session.server";
import { apiFetch } from "../lib/api.server";
import CurrencyInput from "../components/CurrencyInput";
import { Check } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  account_number: string;
  balance: number;
}

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

interface AllUser {
  id: string;
  name: string;
  account_number: string;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const sessionUser = await requireUser(request);
  const [user, transactions, allUsers] = await Promise.all([
    apiFetch<UserData>(`/users/${sessionUser.id}`),
    apiFetch<Transaction[]>(`/transactions/user/${sessionUser.id}`),
    apiFetch<AllUser[]>("/users"),
  ]);
  const otherUsers = allUsers.filter((u) => u.id !== sessionUser.id);
  const userMap: Record<string, AllUser> = {};
  for (const u of allUsers) userMap[u.id] = u;
  return json({ user, transactions, otherUsers, sessionUser, userMap });
}

export async function action({ request }: ActionFunctionArgs) {
  const sessionUser = await requireUser(request);
  const formData = await request.formData();
  const toUserId = formData.get("to_user_id") as string;
  const amount = parseFloat(formData.get("amount") as string);

  if (!toUserId) return json({ error: "Selecione um destinatário." }, { status: 400 });
  if (!amount || amount <= 0) return json({ error: "O valor deve ser maior que zero." }, { status: 400 });

  try {
    const result = await apiFetch<{ status: string; reason?: string }>("/transactions", {
      method: "POST",
      body: JSON.stringify({
        id: `transfer-${sessionUser.id}-${Date.now()}`,
        type: "transfer",
        amount,
        timestamp: new Date().toISOString(),
        from_user_id: sessionUser.id,
        to_user_id: toUserId,
      }),
    });
    if (result.status === "invalid") {
      return json({ error: friendlyError(result.reason) }, { status: 400 });
    }
    return json({ success: true, message: "Transferência realizada com sucesso!" });
  } catch (err) {
    if (err instanceof Response) {
      try {
        const body = await err.json();
        return json({ error: friendlyError(body?.reason || body?.error) }, { status: 400 });
      } catch { /* response wasn't JSON */ }
    }
    return json({ error: "Ocorreu um erro inesperado. Tente novamente em alguns instantes." }, { status: 500 });
  }
}

function friendlyError(reason?: string | null): string {
  if (!reason) return "Não foi possível processar a transferência.";
  if (reason.includes("Insufficient balance")) return "Saldo insuficiente para esta transferência.";
  if (reason.includes("not found")) return "Usuário destinatário não encontrado.";
  if (reason.includes("same user")) return "Não é possível transferir para você mesmo.";
  if (reason.includes("Amount must be positive")) return "O valor precisa ser maior que zero.";
  return reason;
}

function fmt(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}
function fmtDate(ts: string) {
  return new Date(ts).toLocaleString("pt-BR");
}
function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}
function getUserLabel(userMap: Record<string, AllUser>, id: string | null) {
  if (!id) return "—";
  const u = userMap[id];
  return u ? `${u.name} (${u.account_number})` : id.substring(0, 12) + "...";
}

export default function Dashboard() {
  const { user, transactions, otherUsers, sessionUser, userMap } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [showTransfer, setShowTransfer] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<string>("");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!actionData) return;
    if ("success" in actionData) {
      setShowTransfer(false);
      setToast({ type: "success", message: actionData.message });
    } else if ("error" in actionData) {
      setToast({ type: "error", message: actionData.error });
    }
  }, [actionData]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`} onClick={() => setToast(null)}>
          <span className="toast-icon">
            {toast.type === "success" ? <CheckCircle size={18} /> : <XCircle size={18} />}
          </span>
          <span>{toast.message}</span>
          <button className="toast-close">&times;</button>
        </div>
      )}

      {/* Header */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="topbar-logo"><Landmark size={18} /></div>
          <span className="topbar-name">ArthurBank</span>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="topbar-avatar">{getInitials(sessionUser.name)}</div>
            <span>{sessionUser.name}</span>
          </div>
          <Form method="post" action="/logout">
            <button type="submit" className="btn-secondary"><LogOut size={14} /> Sair</button>
          </Form>
        </div>
      </div>

      <div className="main-content">
        {/* Hero — Saldo */}
        <div className="hero-card">
          <div className="hero-label">Saldo Disponível</div>
          <div className="hero-balance">{fmt(user.balance)}</div>
          <div className="hero-account">
            <CreditCard size={14} />
            Conta {user.account_number}
          </div>
        </div>

        {/* Info cards */}
        <div className="info-row">
          <div className="info-card">
            <div className="info-icon blue"><ArrowUpDown size={20} /></div>
            <div className="info-data">
              <span className="info-value">{transactions.length}</span>
              <span className="info-label">Movimentações</span>
            </div>
          </div>
        </div>

        {/* Transfer button */}
        <div className="transfer-section">
          <button className="btn-transfer" onClick={() => setShowTransfer(true)}>
            <SendHorizontal size={18} /> Transferir
          </button>
        </div>

        {/* Transfer Modal */}
        {showTransfer && (
          <div className="modal-overlay" onClick={() => !isSubmitting && setShowTransfer(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Nova Transferência</h3>
                <button className="modal-close" onClick={() => !isSubmitting && setShowTransfer(false)}>&times;</button>
              </div>
              <div className="modal-balance">
                <Wallet size={16} />
                Saldo disponível: <strong>{fmt(user.balance)}</strong>
              </div>
              <Form method="post">
                {actionData && "error" in actionData && (
                  <div className="alert alert-error">
                    <AlertCircle size={15} className="alert-icon" />
                    <span>{actionData.error}</span>
                  </div>
                )}

                <div className="form-group">
                  <label>Destinatários recentes</label>
                  <div className="recipient-list">
                    {otherUsers.map((u) => (
                      <div
                        key={u.id}
                        className={`recipient-item ${selectedRecipient === u.id ? "selected" : ""}`}
                        onClick={() => setSelectedRecipient(u.id)}
                      >
                        <div className="recipient-avatar">{getInitials(u.name)}</div>
                        <div className="recipient-info">
                          <div className="recipient-name">{u.name}</div>
                          <div className="recipient-account">Conta {u.account_number}</div>
                        </div>
                        <div className="recipient-check">
                          {selectedRecipient === u.id && <Check size={12} />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <input type="hidden" name="to_user_id" value={selectedRecipient} />
                </div>

                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label>Valor</label>
                  <CurrencyInput name="amount" id="amount" required />
                </div>

                <button type="submit" className="btn-primary" style={{ width: "100%", marginTop: "1.25rem" }} disabled={isSubmitting || !selectedRecipient}>
                  {isSubmitting ? "Processando..." : "Confirmar Transferência"}
                </button>
              </Form>
            </div>
          </div>
        )}

        {/* Statement */}
        <h3 className="section-title"><ArrowUpDown size={18} /> Extrato</h3>
        {transactions.length === 0 ? (
          <div className="empty-state">
            <ArrowUpDown size={40} />
            <span>Nenhuma movimentação encontrada.</span>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Data</th><th>Tipo</th><th>Valor</th><th>Detalhes</th></tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const isCredit = tx.type === "deposit" || (tx.type === "transfer" && tx.to_user_id === user.id);
                  return (
                    <tr key={tx.id} className="clickable-row" onClick={() => setSelectedTx(tx)}>
                      <td>{fmtDate(tx.timestamp)}</td>
                      <td><span className={`badge badge-${tx.type}`}>{tx.type}</span></td>
                      <td className={isCredit ? "amount-positive" : "amount-negative"}>
                        {isCredit ? "+" : "-"}{fmt(tx.amount)}
                      </td>
                      <td>
                        {tx.type === "transfer" && tx.from_user_id === user.id && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <ArrowUpRight size={14} /> Enviado
                          </span>
                        )}
                        {tx.type === "transfer" && tx.to_user_id === user.id && (
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <ArrowDownLeft size={14} /> Recebido
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Transaction Detail Modal */}
        {selectedTx && (
          <div className="modal-overlay" onClick={() => setSelectedTx(null)}>
            <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Detalhes da Transação</h3>
                <button className="modal-close" onClick={() => setSelectedTx(null)}>&times;</button>
              </div>
              <div className="detail-hero">
                <span className={`badge badge-${selectedTx.type}`} style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}>
                  {selectedTx.type === "deposit" ? "Depósito" : selectedTx.type === "withdraw" ? "Saque" : "Transferência"}
                </span>
                <span className="detail-hero-amount">{fmt(selectedTx.amount)}</span>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">ID da Transação</span>
                  <span className="detail-value mono">{selectedTx.id}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Status</span>
                  <span className="detail-value">
                    <span className={`badge ${selectedTx.status === "processed" ? "badge-deposit" : "badge-withdraw"}`}>
                      {selectedTx.status === "processed" ? "Processada" : "Falhou"}
                    </span>
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Data</span>
                  <span className="detail-value">{fmtDate(selectedTx.timestamp)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Processada em</span>
                  <span className="detail-value">{fmtDate(selectedTx.processed_at)}</span>
                </div>
              </div>
              <hr className="detail-divider" />
              {selectedTx.type === "transfer" && (
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Remetente</span>
                    <span className="detail-value">{getUserLabel(userMap, selectedTx.from_user_id)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Destinatário</span>
                    <span className="detail-value">{getUserLabel(userMap, selectedTx.to_user_id)}</span>
                  </div>
                </div>
              )}
              {(selectedTx.type === "deposit" || selectedTx.type === "withdraw") && (
                <div className="detail-grid">
                  <div className="detail-item full-width">
                    <span className="detail-label">Usuário</span>
                    <span className="detail-value">{getUserLabel(userMap, selectedTx.user_id)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
