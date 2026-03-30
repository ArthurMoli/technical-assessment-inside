# Decisões Técnicas — ArthurBank

Este documento registra as decisões de arquitetura e engenharia do projeto, com ênfase nos mecanismos que garantem **segurança transacional** em um sistema financeiro.

---

## Os 3 Pilares: Idempotência, Atomicidade e Disponibilidade

Em sistemas financeiros, três propriedades determinam se a aplicação é confiável ou um risco jurídico. Cada uma protege contra uma classe de problema real que causa prejuízo financeiro e perda de confiança.

### 1. Idempotência — Processar uma vez, não importa quantas vezes chegue

**O que é:** A garantia de que uma mesma transação, enviada múltiplas vezes, produz o mesmo efeito que se tivesse sido enviada uma única vez.

**Como implementamos:** O campo `id` de cada transação funciona como chave de idempotência. Antes de processar, verificamos se o `id` já existe na tabela `transactions`. Se existir, retornamos `duplicate` sem alterar nenhum saldo. Como o INSERT na tabela e a atualização de saldo acontecem dentro de uma única transação SQL, não existe janela onde um `id` poderia estar registrado sem seu efeito financeiro aplicado.

```
Arquivo: server/services/transaction.service.ts
Fluxo:  SELECT por id → se existe → retorna "duplicate" → nenhuma operação executada
```

**Por que isso importa:**
- **Cenário real:** Usuário clica "Transferir" e a conexão cai. O app reenvia automaticamente. Sem idempotência, o valor é debitado duas vezes. O usuário perde dinheiro.
- **Risco jurídico:** Débito duplicado configura cobrança indevida (Art. 42 do CDC). O cliente tem direito à devolução em dobro do valor cobrado a mais. Em escala, isso gera ações coletivas e sanções regulatórias.
- **Exemplo do mundo real:** Em 2021, a Citibank processou acidentalmente US$900 milhões em pagamentos duplicados por falha de idempotência e não conseguiu reaver todo o valor judicialmente.

**Teste que comprova:**
```
tests/services/transaction.service.test.ts > Idempotency
  ✓ deve ignorar transação duplicada e não alterar saldo
  ✓ deve ignorar duplicata mesmo com campos ligeiramente diferentes
```

---

### 2. Atomicidade — Tudo acontece ou nada acontece

**O que é:** A garantia de que uma operação composta (como uma transferência que envolve débito e crédito) é executada por completo ou revertida por completo. Não existe estado intermediário onde o dinheiro saiu de uma conta mas não chegou na outra.

**Como implementamos:** Toda operação que altera saldo usa `db.transaction()` do SQLite. Para transferências, o débito do remetente e o crédito do destinatário estão dentro do **mesmo** bloco transacional. Se qualquer etapa falha (violação de constraint, erro de I/O, etc.), o SQLite faz rollback automático — nenhum saldo é alterado.

```
Arquivo: server/services/transaction.service.ts
Fluxo:  db.transaction(() => {
          INSERT transação
          UPDATE saldo remetente (-valor)
          UPDATE saldo destinatário (+valor)
        })
        // Se qualquer linha falha → rollback total
```

**Por que isso importa:**
- **Cenário real:** Alice transfere R$1.000 para Bob. O sistema debita Alice, mas o servidor reinicia antes de creditar Bob. Sem atomicidade, R$1.000 desaparece do sistema.
- **Risco jurídico:** Dinheiro "sumido" entre contas constitui falha de custódia. O banco responde por dano material e moral. Em ambiente regulado pelo Banco Central, isso configura incidente operacional que deve ser reportado e pode gerar multa.
- **Nosso teste de conservação:** Após qualquer sequência de operações, a soma total de todos os saldos do sistema permanece idêntica.

**Testes que comprovam:**
```
tests/services/transaction.service.test.ts > Transfer
  ✓ deve debitar o remetente e creditar o destinatário atomicamente
  ✓ deve preservar o saldo total do sistema após transferência
  ✓ deve rejeitar transferência com saldo insuficiente sem afetar nenhuma conta
```

---

### 3. Disponibilidade e Concorrência — O sistema não trava, não corrompe, não nega serviço

**O que é:** A capacidade de atender múltiplas operações simultâneas sem corromper dados, sem travar e sem negar serviço desnecessariamente.

**Como implementamos:**
- **SQLite WAL mode:** Permite leituras concorrentes enquanto uma escrita acontece. Sem WAL, qualquer escrita bloquearia todas as leituras.
- **busy_timeout = 5000ms:** Em vez de falhar imediatamente quando o banco está ocupado, a conexão aguarda até 5 segundos.
- **Retry com backoff exponencial:** Para falhas transitórias (`SQLITE_BUSY`), o sistema retenta até 3 vezes com delays de 100ms, 200ms e 400ms. Erros de validação (não transitórios) não são retentados.
- **Validação de saldo antes do processamento:** Rejeita operações impossíveis antes de entrar na transação SQL, evitando locks desnecessários.

```
Arquivo: server/services/retry.ts
Fluxo:  Tenta executar → SQLITE_BUSY? → aguarda (100ms * 2^tentativa) → retenta
        Erro de validação? → retorna imediatamente, sem retry
```

**Por que isso importa:**
- **Cenário real:** Dois terminais processam saques na mesma conta ao mesmo tempo. Sem controle de concorrência, ambos leem o mesmo saldo, ambos aprovam, e a conta fica negativa.
- **Risco jurídico:** Saldo negativo por falha de sistema (não por crédito autorizado) é responsabilidade da instituição. O cliente não é obrigado a cobrir o prejuízo causado por bug. Além disso, indisponibilidade do serviço financeiro pode configurar violação contratual.
- **Nosso teste de estresse:** 40 transferências simultâneas entre 3 usuários — ao final, nenhum saldo é negativo e a soma total do sistema permanece intacta.

**Testes que comprovam:**
```
tests/services/transaction.service.test.ts > Concurrency
  ✓ deve processar transferências simultâneas sem corromper saldos
  ✓ deve rejeitar corretamente quando dois saques esgotam o saldo
  ✓ deve manter integridade com transferências cruzadas (A→B e B→A)
```

---

## Decisões de Arquitetura

### SQLite como banco de dados

**Escolha:** SQLite com `better-sqlite3` (driver síncrono).

**Motivo:** Para o escopo deste projeto (single-server, sem replicação), SQLite oferece:
- Transações ACID completas sem infraestrutura externa
- `db.transaction()` síncrono que simplifica a lógica de atomicidade
- WAL mode para concorrência de leitura/escrita
- Zero configuração necessária, é só rodar `npm install && npm run dev` e funciona

**Trade-off consciente:** SQLite não escala horizontalmente. Em produção real com milhares de transações por segundo, migraríamos para PostgreSQL. A arquitetura de services/models foi desenhada para que essa migração exija alterações apenas na camada de models, sem tocar na lógica de negócio.

### Saldo armazenado em centavos (INTEGER)

**Escolha:** Todos os valores monetários são armazenados como inteiros em centavos. `R$150,75` é armazenado como `15075`.

**Motivo:** Aritmética de ponto flutuante (float/double) introduz erros de arredondamento. O exemplo clássico: `0.1 + 0.2 = 0.30000000000000004` em JavaScript. Em um sistema financeiro, esses erros se acumulam e geram diferenças contábeis que precisam ser conciliadas manualmente.

A conversão acontece apenas na borda do sistema: a API recebe valores em reais (float) do cliente, converte para centavos (`toCents`) no processamento, e converte de volta (`fromCents`) na resposta.

### UUID em vez de ID sequencial

**Escolha:** Todos os identificadores (users, accounts, transactions) usam UUID v4 (`crypto.randomUUID()`) em vez de IDs numéricos auto-incrementais.

**Motivo:** IDs sequenciais (1, 2, 3...) são previsíveis e expõem a aplicação a **IDOR (Insecure Direct Object Reference)** — uma vulnerabilidade do OWASP Top 10. Se um usuário sabe que seu ID é 45, ele pode tentar acessar `/api/users/46`, `/api/users/47`, etc. e obter dados de outros clientes manipulando a request.

Com UUID (`a77b8e2f-902c-4161-9773-cd4be6c13832`), adivinhar o identificador de outro recurso é computacionalmente inviável. São 2^122 combinações possíveis — não tem como "chutar" e acertar.

**Exemplo prático:** Um atacante intercepta a própria request `GET /api/users/45` e tenta `GET /api/users/46` para ver o saldo de outro cliente. Com UUID, ele vê `GET /api/users/a77b8e2f-...` e não tem como derivar o próximo.

**Observação:** UUID não substitui autorização (um usuário autenticado ainda deve ser impedido de acessar recursos de outros via middleware). Mas é uma camada adicional de defesa que dificulta exploração mesmo se houver falha de autorização.

### Separação User / Account

**Escolha:** Duas entidades separadas em vez de uma tabela só com saldo.

**Motivo:** Em sistema real, um usuário pode ter múltiplas contas (corrente, poupança, etc.). Mesmo que neste projeto a relação seja 1:1, modelar separado demonstra visão de evolução sem overengineering, são apenas duas tabelas com uma FK.

### Express (API) + Remix (Frontend) no mesmo processo

**Escolha:** Express serve a API REST em `/api/*` e monta o handler do Remix para todas as outras rotas. Um único processo Node.js.

**Motivo:**
- A API REST existe independente do Remix — pode ser testada com curl, Postman, ou testes automatizados com supertest
- O Remix consome a API via HTTP, como qualquer cliente faria — provando que a API é funcional e desacoplada
- Single process simplifica deployment para o contexto de um teste técnico

**Motivo de não usar FeathersJS:** Express é mais transparente. Cada decisão de arquitetura é explícita no código, não há convenções implícitas ou "mágica" de framework que o avaliador precisaria conhecer para entender a implementação.

### Zod para validação

**Escolha:** Schemas Zod com `discriminatedUnion` para validar transações por tipo.

**Motivo:** Validação precisa acontecer antes de qualquer operação no banco. Zod permite:
- Definir o formato esperado por tipo de transação (deposit precisa de `user_id`, transfer precisa de `from_user_id` e `to_user_id`)
- Extrair mensagens de erro legíveis para registrar em `invalid_transactions`
- Tipar o resultado da validação para TypeScript inferir os campos corretos

### Pino para logging estruturado

**Escolha:** Pino com output em JSON (produção) e pino-pretty (desenvolvimento).

**Motivo:** Logs estruturados permitem:
- Filtrar por transaction ID, user ID, tipo de operação
- Integrar com ferramentas de observabilidade (Elasticsearch, Datadog, etc.)
- Rastrear o ciclo de vida completo de uma transação: recebida → validada → processada/rejeitada
- Identificar padrões de falha (ex: muitas rejeições por saldo insuficiente em sequência)

### Batch endpoint com ordenação por timestamp

**Escolha:** `POST /api/transactions/batch` recebe um array, ordena por `timestamp`, processa sequencialmente.

**Motivo:** O requisito diz que "transações podem chegar fora de ordem". Ao ordenar por timestamp antes de processar, maximizamos a chance de sucesso — um depósito com timestamp anterior será processado antes de um saque posterior, mesmo que tenham chegado na ordem inversa.

**Limite da abordagem:** Se um saque chega individualmente (não em batch) antes do depósito que o cobriria, ele será rejeitado. Isso é correto: em sistema real, não se pode sacar dinheiro que não está na conta, independente de o que timestamps futuros dizem. Documentamos essa decisão em vez de tentar "adivinhar" transações futuras.

### Credenciais de demonstração visíveis na tela de login

**Escolha:** As credenciais dos usuários demo são exibidas na própria tela de login, acompanhadas de um badge "Ambiente de demonstração".

**Motivo:** Em um teste técnico, a prioridade é que o avaliador consiga testar a aplicação com o menor atrito possível. Esconder as credenciais em um documento externo (README) adiciona fricção desnecessária — o avaliador precisa sair do app, abrir outro arquivo, copiar credenciais e voltar. Mostrar diretamente na UI elimina isso.

**Ressalva:** Em produção, isso seria removido. Credenciais expostas na interface são uma vulnerabilidade óbvia. O badge "Ambiente de demonstração" existe para deixar explícito que essa decisão é intencional e restrita ao contexto de desenvolvimento/avaliação, não um descuido de segurança. Em um ambiente real, a tela de login não exibiria nenhuma informação de credencial, e os usuários de seed nem existiriam.

### Depósito e saque expostos no painel administrativo

**Escolha:** Os 3 tipos de transação (deposit, withdraw, transfer) são suportados pela API, mas na interface cada um vive onde faz sentido: transferência no dashboard do usuário, depósito e saque no painel admin (aba "Operações").

**Motivo:** Em um app bancário real, o usuário final não faz depósito ou saque pela interface — essas operações acontecem em outros canais (caixa eletrônico, PIX recebido, operação de caixa). Colocar um botão "Depositar" no app do cliente seria irreal. No entanto, o sistema precisa demonstrar que processa os 3 tipos corretamente. A solução foi expor depósito e saque no painel do administrador, simulando um operador de caixa que registra essas movimentações. Isso permite que o avaliador teste todos os tipos de transação pela UI sem forçar uma experiência irreal no app do usuário.
