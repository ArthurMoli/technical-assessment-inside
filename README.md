# ArthurBank

Aplicação bancária fictícia para processamento de transações financeiras. Construída como teste técnico para a vaga de Desenvolvedor Back-end Pleno.

## Stack

- **Backend:** Node.js + Express (API REST)
- **Frontend:** Remix (SSR)
- **Banco de dados:** SQLite (better-sqlite3)
- **Linguagem:** TypeScript
- **Testes:** Vitest
- **Logging:** Pino (structured logging)
- **Validação:** Zod

## Requisitos

- Node.js >= 20.0.0
- npm

## Setup

```bash
# Instalar dependências
npm install

# Copiar variáveis de ambiente
cp .env.example .env

# Iniciar em modo desenvolvimento
npm run dev
```

O servidor inicia em `http://localhost:3000`. Na primeira execução, o banco de dados é criado automaticamente com migrações e dados de demonstração (6 usuários).

## Credenciais de Teste

| Tipo | Email | Senha |
|------|-------|-------|
| Admin | admin@arthurbank.com | admin123 |
| Usuário | alice@arthurbank.com | alice123 |
| Usuário | bob@arthurbank.com | bob123 |
| Usuário | carlos@arthurbank.com | carlos123 |
| Usuário | diana@arthurbank.com | diana123 |
| Usuário | eduardo@arthurbank.com | eduardo123 |

Se surgir a necessidade/vontade, é possível acessar todas as contas e usar normalmente.

## Testes

```bash
# Rodar todos os testes
npm test

# Rodar em modo watch
npm run test:watch

# Rodar com coverage
npm run test:coverage
```

**27 testes automatizados** cobrindo:
- Depósito, saque e transferência (operações básicas)
- Idempotência (duplicatas ignoradas)
- Validação (10 cenários de dados inválidos)
- Concorrência (40 transferências simultâneas, saques concorrentes, transferências cruzadas)
- Batch processing (ordenação por timestamp, duplicatas, mix válidas/inválidas)

## Arquitetura

```
arthurbank/
├── server/                  # Backend (Express API)
│   ├── index.ts             # Bootstrap: Express + Remix no mesmo processo
│   ├── db/                  # SQLite: connection, migrations, seed
│   ├── models/              # Camada de acesso a dados
│   ├── services/            # Lógica de negócio (transações, saldo, retry)
│   ├── routes/              # Endpoints REST (/api/*)
│   ├── middleware/           # Error handler, request logger
│   ├── lib/                 # Logger (pino)
│   └── types/               # Interfaces TypeScript + schemas Zod
├── app/                     # Frontend (Remix)
│   ├── routes/              # Páginas: login, dashboard, admin
│   ├── lib/                 # Session, API client
│   └── styles/              # CSS
├── tests/                   # Testes automatizados (Vitest)
├── DECISIONS.md             # Documentação de decisões técnicas
└── AI_USAGE.md              # Documentação sobre uso de IA
```

**Princípio de separação:** O backend funciona como API REST independente. O Remix consome essa API via HTTP como qualquer client. A lógica de negócio nunca vive no frontend.

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check (ping no banco) |
| POST | `/api/auth/login` | Login (email + senha) |
| GET | `/api/users` | Lista usuários com saldos |
| GET | `/api/users/:id` | Usuário específico com saldo |
| POST | `/api/transactions` | Processar uma transação |
| POST | `/api/transactions/batch` | Processar lote (ordena por timestamp) |
| GET | `/api/transactions` | Listar transações (paginado) |
| GET | `/api/transactions/summary` | Resumo agregado (totais) |
| GET | `/api/transactions/invalid` | Listar transações rejeitadas |
| GET | `/api/transactions/user/:userId` | Extrato de um usuário |

## Formato de Transação

```json
// Depósito
{
  "id": "tx-001",
  "type": "deposit",
  "amount": 150.50,
  "timestamp": "2026-03-29T10:00:00Z",
  "user_id": "uuid-do-usuario"
}

// Saque
{
  "id": "tx-002",
  "type": "withdraw",
  "amount": 50.00,
  "timestamp": "2026-03-29T10:01:00Z",
  "user_id": "uuid-do-usuario"
}

// Transferência
{
  "id": "tx-003",
  "type": "transfer",
  "amount": 200.00,
  "timestamp": "2026-03-29T10:02:00Z",
  "from_user_id": "uuid-remetente",
  "to_user_id": "uuid-destinatario"
}
```

## Garantias do Sistema

- **Idempotência:** Transações duplicadas (mesmo `id`) são ignoradas sem efeito colateral
- **Atomicidade:** Transferências debitam e creditam dentro de uma única transação SQL — tudo ou nada
- **Integridade:** Saldos em centavos (INTEGER), sem erros de ponto flutuante
- **Validação:** Dados inválidos são rejeitados e registrados com motivo na tabela `invalid_transactions`
- **Resiliência:** Retry com backoff exponencial para falhas transitórias (SQLITE_BUSY)
- **Observabilidade:** Logging estruturado (Pino) em toda operação

Para detalhes sobre essas decisões e seu impacto, consulte [DECISIONS.md](DECISIONS.md).
