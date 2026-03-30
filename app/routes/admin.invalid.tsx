import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { ShieldAlert } from "lucide-react";
import { apiFetch } from "../lib/api.server";

interface InvalidTransaction {
  id: number;
  original_id: string | null;
  raw_data: string;
  error_reason: string;
  received_at: string;
}
interface InvalidList { items: InvalidTransaction[]; total: number; }

export async function loader() {
  const data = await apiFetch<InvalidList>("/transactions/invalid?limit=100");
  return json(data);
}

function fmtDate(ts: string) { return new Date(ts).toLocaleString("pt-BR"); }

export default function AdminInvalid() {
  const { items, total } = useLoaderData<typeof loader>();

  return (
    <div>
      <p className="page-subtitle" style={{ marginBottom: "1.25rem" }}>
        {total} transação(ões) rejeitada(s)
      </p>

      {items.length === 0 ? (
        <div className="empty-state"><ShieldAlert size={40} /><span>Nenhuma transação inválida.</span></div>
      ) : (
        <div className="table-container">
          <table>
            <thead><tr><th>Data</th><th>ID Original</th><th>Motivo</th><th>Dados</th></tr></thead>
            <tbody>
              {items.map((tx) => (
                <tr key={tx.id}>
                  <td>{fmtDate(tx.received_at)}</td>
                  <td className="mono">{tx.original_id || "—"}</td>
                  <td className="error-reason">{tx.error_reason}</td>
                  <td><pre className="raw-data">{JSON.stringify(JSON.parse(tx.raw_data), null, 2)}</pre></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
