import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useRouteError,
  isRouteErrorResponse,
  Link,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import globalStyles from "./styles/global.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: globalStyles },
];

export default function App() {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ArthurBank</title>
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  let title = "Algo deu errado";
  let message = "Ocorreu um erro inesperado. Tente novamente.";
  let status = 500;

  if (isRouteErrorResponse(error)) {
    status = error.status;
    switch (error.status) {
      case 401:
        title = "Acesso negado";
        message = "Você precisa estar logado para acessar esta página.";
        break;
      case 403:
        title = "Sem permissão";
        message = "Você não tem permissão para acessar esta página.";
        break;
      case 404:
        title = "Página não encontrada";
        message = "A página que você procura não existe ou foi removida.";
        break;
      default:
        message = error.data?.message || message;
    }
  }

  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title} - ArthurBank</title>
        <Meta />
        <Links />
      </head>
      <body>
        <div className="error-page">
          <div className="error-card">
            <div className="error-status">{status}</div>
            <h1 className="error-title">{title}</h1>
            <p className="error-message">{message}</p>
            <Link to="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-block", marginTop: "1rem" }}>
              Voltar ao início
            </Link>
          </div>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
