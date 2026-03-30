# Uso de IA — ArthurBank

## Ferramenta utilizada

**Claude Code** (claude.ai/code) — CLI da Anthropic para desenvolvimento assistido por IA, rodando o modelo Claude Opus.

## Como a IA foi utilizada

### Planejamento e Arquitetura
A IA foi usada como par de programação para discutir decisões de arquitetura antes de escrever código. As decisões finais foram tomadas por mim:

- **Express vs FeathersJS:** Discuti os prós e contras de cada um, pois trabalho com o FeathersJS e conheço a estrutura dele, no entanto o Express é ótimo para projetos desse porte pela simplicidade. Optei por Express pela transparência.
- **Modelagem User/Account separados:** Tive a ideia de separar a entidade Conta da entidade Usuário, então consultei o Claude pra avaliar os prós e contras. A IA concordou com os pontos que eu apresentei em prol da separação, e eu segui nessa abordagem por motivos de:

Na vida real, um usuario pode ter mais de uma conta e apesar do sistema ser simples e não termos esse caso de uso, ele não é impossível de implementar porque nossa base já está preparada pra essa feature se for necessário. Também é mais semanticamente correto e seguro, visto que se algum invasor conseguir ler a tabela de usuários ainda assim não vai conseguir saber o saldo sem que leia a tabela de Conta.

- **Remix para frontend:** Decisão minha pela familiaridade. A IA validou e recomendou manter a lógica de negócio fora do Remix.

O back-end funciona como uma API REST seguindo padrões de desenvolvimento, mas o front-end em remix foi uma maneira de eu conseguir desenvolver algo bonito (o Remix dá muita possibilidade pra isso) e fazer algo legal pela minha familiaridade com o framework, dado o fato que já trabalho a mais de 1 ano com ele.

### Geração de Código
A IA gerou a estrutura inicial dos arquivos (models, services, routes, migrations) seguindo as decisões que tomamos juntos. O código core — especialmente o `transaction.service.ts` — foi gerado pela IA mas revisado por mim para garantir que:
- A validação Zod cobria todos os edge cases
- As transações SQL eram realmente atômicas
- A idempotência funcionava corretamente

Prezei muito pela idempotência e atomicidade das transações, acredito que essas 2 práticas evitem muita dor de cabeça para as empresas do ramo financeiro, evitando a duplicidade de operações e também evitando que o dinheiro saia de uma conta e não chegue na outra ou vice-versa (Isso aprendi com um professor da faculdade que é funcionario de cybersegurança da Caixa Econômica a mais de 30 anos.)

### Testes
Os cenários de teste foram definidos em conjunto. Eu queria especificamente testar concorrência (o que acontece com 2 ou mais usuários transferindo ao mesmo tempo). A IA escreveu os testes e eu validei que eles faziam sentido.

## O que precisei corrigir / decisões que a IA tomou errado


### 1. Dashboard aberto mostrando dados de todos os usuários

A IA criou um dashboard único onde qualquer pessoa via o saldo de todos os usuários. Eu olhei aquilo e pensei: isso não faz sentido pra um app bancário. Um cliente não pode ver o saldo dos outros. Pedi pra separar em duas áreas: uma de usuário (com login, vê só os próprios dados) e uma de admin (painel com visão geral). A IA não teria feito essa separação sozinha, então desenvolvemos pouco a pouco todo o sistema de login e separação entre usuário cliente e admin.

### 2. Saldo inicial aparecendo "do nada"

O seed original do banco de dados criava as contas já com saldo, tipo: Alice começa com R$5.000 sem nenhum registro de onde veio esse dinheiro. Eu questionei: se alguém abre o extrato da Alice, a primeira coisa que aparece é o saldo mas sem nenhuma transação que justifique. Pedi pra registrar o saldo inicial como uma transação de depósito. Agora o extrato mostra o depósito de abertura de conta.

### 3. Select de destinatário genérico

Pra transferir dinheiro, a IA colocou um `<select>` dropdown mostrando "Alice Santos (Conta: 1001)". Isso parece formulário de sistema interno, não app de banco. Eu pedi pra trocar por uma lista visual de "Destinatários recentes" com avatar, nome e conta clicável, com feedback visual de seleção pra que ficasse mais próximo de como uma aplicação de banco real se comporta.

### 4. Input de valor sem formatação

O campo de valor era um `<input type="number">` cru. Eu digitava 6000 e aparecia 6000. Ajustei o R$ fixo à esquerda e formatei como eu achei que ficaria mais estético: 6.000,00.

## Exemplo de erro da IA e como identifiquei

Ao tentar transferir um valor acima do saldo disponível (R$6.000 com saldo de R$5.000), a mensagem de erro exibida era "Erro inesperado. Tente novamente." — genérica e inútil pro usuário. O problema era que a API retornava o erro corretamente (status 400 com "Insufficient balance"), mas o frontend não estava lendo a resposta da API em caso de erro — caía direto num catch genérico que não informava o usuário do que tava acontecendo.

Identifiquei testando manualmente o fluxo de transferência. A correção foi tratar a resposta de erro da API no catch, extrair o JSON com o motivo, e traduzir as mensagens pra português claro: "Saldo insuficiente para esta transferência."

Esse tipo de problema a IA não pega sozinha porque ela não testa o app como usuário, ela gera o código e segue em frente. Quem identifica é quem abre o app e usa.

## Reflexão

A IA acelerou muito a parte de boilerplate: migrations, models, CRUD routes, CSS. Foi útil como "par de programação" pra discutir prós e contras. Mas as decisões que definiram a qualidade do projeto foram minhas: separar user/admin, registrar saldo como transação, redesenhar a UI de transferência, pedir testes de concorrência. A IA executa bem quando direcionada, mas sem direcionamento ela entrega algo genérico e superficial, a versão inicial do projeto era muito inferior a que eu estou entregando no final. O papel do desenvolvedor é justamente esse: saber o que ajustar e identificar quando o resultado não está bom.

## Melhorias Futuras pro projeto

Pensei em algumas coisas que poderíamos implementar caso o projeto fosse continuado:

- Primeiramente um retrabalho de identidade visual, "ArthurBank" não é muito comercial
- Criação de conta de usuário, hoje em dia só conseguimos fazer login, não criar conta
- Redefinição de senha
- Possível feature de cartão de crédito
- ArthurBank Investimentos: possibilitar que o usuario faça aplicações de dinheiro em ações, cripto, etc.
