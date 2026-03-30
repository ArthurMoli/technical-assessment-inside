import { json, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, useActionData } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  ArrowDownToLine, ArrowUpFromLine, AlertCircle, CheckCircle, XCircle,
} from "lucide-react";
import { apiFetch } from "../lib/api.server";
import CurrencyInput from "../components/CurrencyInput";

interface User {
  id: string;
  name: string;
  account_number: string;
  balance: number;
}

export async function loader() {
  const users = await apiFetch<User[]>("/users");
  return json({ users });
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const type = formData.get("type") as string;
  const userId = formData.get("user_id") as string;
  const amount = parseFloat(formData.get("amount") as string);

  if (!userId) return json({ error: "Selecione um usuário." }, { status: 400 });
  if (!amount || amount <= 0) return json({ error: "O valor deve ser maior que zero." }, { status: 400 });
  if (type !== "deposit" && type !== "withdraw") return json({ error: "Tipo de operação inválido." }, { status: 400 });

  try {
    const txId = `admin-${type}-${userId}-${Date.now()}`;
    const result = await apiFetch<{ status: string; reason?: string }>("/transactions", {
      method: "POST",
      body: JSON.stringify({
        id: txId,
        type,
        amount,
        timestamp: new Date().toISOString(),
        user_id: userId,
      }),
    });

    if (result.status === "invalid") {
      return json({ error: friendlyError(result.reason, type) }, { status: 400 });
    }

    const label = type === "deposit" ? "Depósito" : "Saque";
    return json({ success: true, message: `${label} registrado com sucesso!` });
  } catch (err) {
    if (err instanceof Response) {
      try {
        const body = await err.json();
        return json({ error: friendlyError(body?.reason || body?.error, type) }, { status: 400 });
      } catch { /* response wasn't JSON */ }
    }
    return json({ error: "Ocorreu um erro inesperado. Tente novamente em alguns instantes." }, { status: 500 });
  }
}

function friendlyError(reason?: string | null, type?: string): string {
  if (!reason) return "Não foi possível processar a operação.";
  if (reason.includes("Insufficient balance")) {
    return type === "withdraw"
      ? "Saldo insuficiente para este saque."
      : "Saldo insuficiente.";
  }
  if (reason.includes("not found")) return "Usuário não encontrado.";
  if (reason.includes("Amount must be positive")) return "O valor precisa ser maior que zero.";
  return reason;
}

function fmt(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
}

export default function AdminOperations() {
  const { users } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [operationType, setOperationType] = useState<"deposit" | "withdraw">("deposit");
  const [selectedUser, setSelectedUser] = useState("");
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (!actionData) return;
    if ("success" in actionData) {
      setSelectedUser("");
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
    <div>
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

      <p className="page-subtitle" style={{ marginBottom: "1.5rem" }}>
        Registrar depósitos e saques como operador de caixa.
      </p>

      <div style={{ maxWidth: 520 }}>
        <Form method="post">
          {/* Tipo de operação */}
          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label>Tipo de operação</label>
            <div className="operation-toggle">
              <button
                type="button"
                className={`operation-btn ${operationType === "deposit" ? "active deposit" : ""}`}
                onClick={() => setOperationType("deposit")}
              >
                <ArrowDownToLine size={16} /> Depósito
              </button>
              <button
                type="button"
                className={`operation-btn ${operationType === "withdraw" ? "active withdraw" : ""}`}
                onClick={() => setOperationType("withdraw")}
              >
                <ArrowUpFromLine size={16} /> Saque
              </button>
            </div>
            <input type="hidden" name="type" value={operationType} />
          </div>

          {/* Seleção de usuário */}
          <div className="form-group" style={{ marginBottom: "1.25rem" }}>
            <label>Conta do cliente</label>
            <div className="recipient-list" style={{ maxHeight: 200 }}>
              {users.filter(u => u.account_number !== "0001").map((u) => (
                <div
                  key={u.id}
                  className={`recipient-item ${selectedUser === u.id ? "selected" : ""}`}
                  onClick={() => setSelectedUser(u.id)}
                >
                  <div className="recipient-avatar">{getInitials(u.name)}</div>
                  <div className="recipient-info">
                    <div className="recipient-name">{u.name}</div>
                    <div className="recipient-account">Conta {u.account_number} &middot; Saldo: {fmt(u.balance)}</div>
                  </div>
                  <div className="recipient-check">
                    {selectedUser === u.id && <CheckCircle size={14} />}
                  </div>
                </div>
              ))}
            </div>
            <input type="hidden" name="user_id" value={selectedUser} />
          </div>

          {/* Valor */}
          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label>Valor</label>
            <CurrencyInput name="amount" id="op-amount" required />
          </div>

          {/* Erro inline */}
          {actionData && "error" in actionData && (
            <div className="alert alert-error" style={{ marginBottom: "1rem" }}>
              <AlertCircle size={15} className="alert-icon" />
              <span>{actionData.error}</span>
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%" }}
            disabled={isSubmitting || !selectedUser}
          >
            {isSubmitting
              ? "Processando..."
              : operationType === "deposit"
                ? "Registrar Depósito"
                : "Registrar Saque"}
          </button>
        </Form>
      </div>
    </div>
  );
}
