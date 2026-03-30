import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { redirect } from "@remix-run/node";
import { Landmark, AlertCircle } from "lucide-react";
import { apiFetch } from "../lib/api.server";
import { createUserSession, getUser } from "../lib/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await getUser(request);
  if (user) return redirect(user.role === "admin" ? "/admin" : "/dashboard");
  return json({});
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return json({ error: "Preencha todos os campos" }, { status: 400 });
  }

  try {
    const user = await apiFetch<{ id: string; name: string; email: string; role: "user" | "admin" }>(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) }
    );
    return createUserSession(user, user.role === "admin" ? "/admin" : "/dashboard");
  } catch {
    return json({ error: "Email ou senha inválidos" }, { status: 401 });
  }
}

export default function Login() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "var(--primary)", display: "flex",
            alignItems: "center", justifyContent: "center"
          }}>
            <Landmark size={24} color="white" />
          </div>
        </div>
        <h1 className="login-title">ArthurBank</h1>
        <p className="login-subtitle">Acesse sua conta</p>

        <Form method="post" className="login-form">
          {actionData?.error && (
            <div className="alert alert-error">
              <AlertCircle size={16} className="alert-icon" />
              <span>{actionData.error}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="seu@email.com" required autoFocus />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input id="password" name="password" type="password" placeholder="Sua senha" required />
          </div>

          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Entrando..." : "Entrar"}
          </button>
        </Form>

        <div className="login-hint">
          <p className="login-env-badge">Ambiente de demonstração</p>
          <p><strong>Usuários de teste:</strong></p>
          <p>alice@arthurbank.com / alice123</p>
          <p>admin@arthurbank.com / admin123</p>
        </div>
      </div>
    </div>
  );
}
