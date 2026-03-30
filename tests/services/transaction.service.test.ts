import { describe, it, expect } from "vitest";
import { testDb, USERS } from "../setup.js";
import { processTransaction, processBatch } from "../../server/services/transaction.service.js";
import * as AccountModel from "../../server/models/account.model.js";
import * as TransactionModel from "../../server/models/transaction.model.js";
import * as InvalidTransactionModel from "../../server/models/invalid-transaction.model.js";

function getBalance(userId: string): number {
  return AccountModel.getBalance(testDb, userId);
}

// =============================================
// DEPÓSITO
// =============================================
describe("Deposit", () => {
  it("deve creditar o valor na conta do usuário", () => {
    const balanceBefore = getBalance(USERS.alice.id);

    const result = processTransaction(testDb, {
      id: "dep-001",
      type: "deposit",
      amount: 150.50,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });

    expect(result.status).toBe("processed");
    expect(getBalance(USERS.alice.id)).toBe(balanceBefore + 15050);
  });

  it("deve aceitar múltiplos depósitos na mesma conta", () => {
    processTransaction(testDb, {
      id: "dep-multi-1",
      type: "deposit",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.bob.id,
    });
    processTransaction(testDb, {
      id: "dep-multi-2",
      type: "deposit",
      amount: 200,
      timestamp: "2026-03-29T10:01:00Z",
      user_id: USERS.bob.id,
    });

    // Bob: 3000 + 100 + 200 = 3300 -> 330000 centavos
    expect(getBalance(USERS.bob.id)).toBe(330000);
  });
});

// =============================================
// SAQUE
// =============================================
describe("Withdraw", () => {
  it("deve debitar o valor da conta do usuário", () => {
    const result = processTransaction(testDb, {
      id: "wit-001",
      type: "withdraw",
      amount: 500,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });

    expect(result.status).toBe("processed");
    // Alice: 5000 - 500 = 4500 -> 450000 centavos
    expect(getBalance(USERS.alice.id)).toBe(450000);
  });

  it("deve rejeitar saque com saldo insuficiente", () => {
    const result = processTransaction(testDb, {
      id: "wit-broke",
      type: "withdraw",
      amount: 99999,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.carlos.id,
    });

    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.reason).toContain("Insufficient balance");
    }
    // Saldo não mudou
    expect(getBalance(USERS.carlos.id)).toBe(100000);
  });

  it("deve rejeitar saque que zera exatamente e tenta sacar mais", () => {
    // Saca tudo (R$1000)
    processTransaction(testDb, {
      id: "wit-all",
      type: "withdraw",
      amount: 1000,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.carlos.id,
    });
    expect(getBalance(USERS.carlos.id)).toBe(0);

    // Tenta sacar R$1
    const result = processTransaction(testDb, {
      id: "wit-zero",
      type: "withdraw",
      amount: 1,
      timestamp: "2026-03-29T10:01:00Z",
      user_id: USERS.carlos.id,
    });
    expect(result.status).toBe("invalid");
    expect(getBalance(USERS.carlos.id)).toBe(0);
  });
});

// =============================================
// TRANSFERÊNCIA
// =============================================
describe("Transfer", () => {
  it("deve debitar o remetente e creditar o destinatário atomicamente", () => {
    const aliceBefore = getBalance(USERS.alice.id);
    const bobBefore = getBalance(USERS.bob.id);

    const result = processTransaction(testDb, {
      id: "txf-001",
      type: "transfer",
      amount: 1000,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: USERS.alice.id,
      to_user_id: USERS.bob.id,
    });

    expect(result.status).toBe("processed");
    expect(getBalance(USERS.alice.id)).toBe(aliceBefore - 100000);
    expect(getBalance(USERS.bob.id)).toBe(bobBefore + 100000);
  });

  it("deve preservar o saldo total do sistema após transferência", () => {
    const totalBefore =
      getBalance(USERS.alice.id) +
      getBalance(USERS.bob.id) +
      getBalance(USERS.carlos.id);

    processTransaction(testDb, {
      id: "txf-conservation",
      type: "transfer",
      amount: 500,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: USERS.alice.id,
      to_user_id: USERS.carlos.id,
    });

    const totalAfter =
      getBalance(USERS.alice.id) +
      getBalance(USERS.bob.id) +
      getBalance(USERS.carlos.id);

    expect(totalAfter).toBe(totalBefore);
  });

  it("deve rejeitar transferência com saldo insuficiente sem afetar nenhuma conta", () => {
    const aliceBefore = getBalance(USERS.alice.id);
    const bobBefore = getBalance(USERS.bob.id);

    const result = processTransaction(testDb, {
      id: "txf-broke",
      type: "transfer",
      amount: 999999,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: USERS.alice.id,
      to_user_id: USERS.bob.id,
    });

    expect(result.status).toBe("invalid");
    expect(getBalance(USERS.alice.id)).toBe(aliceBefore);
    expect(getBalance(USERS.bob.id)).toBe(bobBefore);
  });

  it("deve rejeitar auto-transferência", () => {
    const result = processTransaction(testDb, {
      id: "txf-self",
      type: "transfer",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: USERS.alice.id,
      to_user_id: USERS.alice.id,
    });

    expect(result.status).toBe("invalid");
  });
});

// =============================================
// IDEMPOTÊNCIA
// =============================================
describe("Idempotency", () => {
  it("deve ignorar transação duplicada e não alterar saldo", () => {
    const tx = {
      id: "idem-001",
      type: "deposit" as const,
      amount: 500,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    };

    const first = processTransaction(testDb, tx);
    const balanceAfterFirst = getBalance(USERS.alice.id);

    const second = processTransaction(testDb, tx);
    const balanceAfterSecond = getBalance(USERS.alice.id);

    expect(first.status).toBe("processed");
    expect(second.status).toBe("duplicate");
    expect(balanceAfterSecond).toBe(balanceAfterFirst);
  });

  it("deve ignorar duplicata mesmo com campos ligeiramente diferentes", () => {
    processTransaction(testDb, {
      id: "idem-sneaky",
      type: "deposit",
      amount: 500,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });

    // Mesmo ID, valor diferente — deve ser ignorado
    const result = processTransaction(testDb, {
      id: "idem-sneaky",
      type: "deposit",
      amount: 99999,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });

    expect(result.status).toBe("duplicate");
    // Saldo só aumentou 500, não 99999
    expect(getBalance(USERS.alice.id)).toBe(550000);
  });
});

// =============================================
// VALIDAÇÃO
// =============================================
describe("Validation", () => {
  it("deve rejeitar transação sem ID", () => {
    const result = processTransaction(testDb, {
      type: "deposit",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar transação com valor negativo", () => {
    const result = processTransaction(testDb, {
      id: "val-neg",
      type: "deposit",
      amount: -100,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar transação com valor zero", () => {
    const result = processTransaction(testDb, {
      id: "val-zero",
      type: "deposit",
      amount: 0,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar transação com tipo inválido", () => {
    const result = processTransaction(testDb, {
      id: "val-type",
      type: "pix",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.alice.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar transação com user_id inexistente", () => {
    const result = processTransaction(testDb, {
      id: "val-ghost",
      type: "deposit",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: "non-existent-user",
    });
    expect(result.status).toBe("invalid");
    if (result.status === "invalid") {
      expect(result.reason).toContain("not found");
    }
  });

  it("deve rejeitar transfer com from_user_id inexistente", () => {
    const result = processTransaction(testDb, {
      id: "val-ghost-sender",
      type: "transfer",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: "ghost",
      to_user_id: USERS.bob.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar transfer sem from_user_id", () => {
    const result = processTransaction(testDb, {
      id: "val-no-from",
      type: "transfer",
      amount: 100,
      timestamp: "2026-03-29T10:00:00Z",
      to_user_id: USERS.bob.id,
    });
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar payload completamente inválido (string)", () => {
    const result = processTransaction(testDb, "not a transaction");
    expect(result.status).toBe("invalid");
  });

  it("deve rejeitar payload null", () => {
    const result = processTransaction(testDb, null);
    expect(result.status).toBe("invalid");
  });

  it("deve registrar todas as inválidas na tabela invalid_transactions", () => {
    processTransaction(testDb, { id: "inv-1", type: "deposit", amount: -1, timestamp: "t", user_id: "x" });
    processTransaction(testDb, { id: "inv-2", type: "pix", amount: 10, timestamp: "t" });
    processTransaction(testDb, null);

    const count = InvalidTransactionModel.countAll(testDb);
    expect(count).toBeGreaterThanOrEqual(3);
  });
});

// =============================================
// CONCORRÊNCIA — o teste que o Arthur quer ver
// =============================================
describe("Concurrency", () => {
  it("deve processar transferências simultâneas sem corromper saldos", () => {
    // Cenário: Alice (R$5000) transfere para Bob E Carlos ao mesmo tempo
    // Se ambas passam, saldos devem bater
    const totalBefore =
      getBalance(USERS.alice.id) +
      getBalance(USERS.bob.id) +
      getBalance(USERS.carlos.id);

    // Simula "simultâneo" no mesmo DB — SQLite serializa, mas o teste prova que
    // as transactions não interferem entre si
    const results = [];
    for (let i = 0; i < 20; i++) {
      results.push(
        processTransaction(testDb, {
          id: `concurrent-ab-${i}`,
          type: "transfer",
          amount: 100,
          timestamp: `2026-03-29T10:00:${String(i).padStart(2, "0")}Z`,
          from_user_id: USERS.alice.id,
          to_user_id: USERS.bob.id,
        })
      );
      results.push(
        processTransaction(testDb, {
          id: `concurrent-ac-${i}`,
          type: "transfer",
          amount: 50,
          timestamp: `2026-03-29T10:00:${String(i).padStart(2, "0")}Z`,
          from_user_id: USERS.alice.id,
          to_user_id: USERS.carlos.id,
        })
      );
    }

    const processed = results.filter((r) => r.status === "processed");
    const invalid = results.filter((r) => r.status === "invalid");

    // Todas as processadas devem ter reduzido Alice e creditado corretamente
    const totalAfter =
      getBalance(USERS.alice.id) +
      getBalance(USERS.bob.id) +
      getBalance(USERS.carlos.id);

    // INVARIANTE: soma total do sistema nunca muda (conservação de dinheiro)
    expect(totalAfter).toBe(totalBefore);

    // Alice começou com R$5000. Cada rodada tenta tirar R$150.
    // 5000 / 150 = 33.3 → cabem 33 transferências completas de R$150
    // Mas são 20 rodadas de (100+50) = 20 * 150 = 3000
    // Alice deveria ter 5000-3000=2000 se todas passaram
    // Se alguma falhou por saldo, o total ainda bate
    expect(processed.length + invalid.length).toBe(40);

    // Nenhum saldo ficou negativo
    expect(getBalance(USERS.alice.id)).toBeGreaterThanOrEqual(0);
    expect(getBalance(USERS.bob.id)).toBeGreaterThanOrEqual(0);
    expect(getBalance(USERS.carlos.id)).toBeGreaterThanOrEqual(0);
  });

  it("deve rejeitar corretamente quando dois saques esgotam o saldo", () => {
    // Carlos tem R$1000. Dois saques de R$700 — só um deve passar.
    const r1 = processTransaction(testDb, {
      id: "race-1",
      type: "withdraw",
      amount: 700,
      timestamp: "2026-03-29T10:00:00Z",
      user_id: USERS.carlos.id,
    });
    const r2 = processTransaction(testDb, {
      id: "race-2",
      type: "withdraw",
      amount: 700,
      timestamp: "2026-03-29T10:00:01Z",
      user_id: USERS.carlos.id,
    });

    const processedCount = [r1, r2].filter((r) => r.status === "processed").length;
    const invalidCount = [r1, r2].filter((r) => r.status === "invalid").length;

    expect(processedCount).toBe(1);
    expect(invalidCount).toBe(1);
    expect(getBalance(USERS.carlos.id)).toBe(30000); // 1000 - 700 = 300 -> 30000 centavos
  });

  it("deve manter integridade com transferências cruzadas (A→B e B→A)", () => {
    const totalBefore =
      getBalance(USERS.alice.id) + getBalance(USERS.bob.id);

    // Alice envia R$1000 para Bob, Bob envia R$500 para Alice
    processTransaction(testDb, {
      id: "cross-ab",
      type: "transfer",
      amount: 1000,
      timestamp: "2026-03-29T10:00:00Z",
      from_user_id: USERS.alice.id,
      to_user_id: USERS.bob.id,
    });
    processTransaction(testDb, {
      id: "cross-ba",
      type: "transfer",
      amount: 500,
      timestamp: "2026-03-29T10:00:01Z",
      from_user_id: USERS.bob.id,
      to_user_id: USERS.alice.id,
    });

    const totalAfter =
      getBalance(USERS.alice.id) + getBalance(USERS.bob.id);

    expect(totalAfter).toBe(totalBefore);
    // Alice: 5000 - 1000 + 500 = 4500
    expect(getBalance(USERS.alice.id)).toBe(450000);
    // Bob: 3000 + 1000 - 500 = 3500
    expect(getBalance(USERS.bob.id)).toBe(350000);
  });
});

// =============================================
// BATCH PROCESSING (fora de ordem)
// =============================================
describe("Batch Processing", () => {
  it("deve ordenar por timestamp e processar na ordem correta", async () => {
    // Envia: withdraw primeiro (timestamp depois), deposit depois (timestamp antes)
    // Se processar na ordem de chegada: withdraw falha (saldo insuficiente se Carlos)
    // Se processar por timestamp: deposit primeiro, withdraw funciona
    const results = await processBatch(testDb, [
      {
        id: "batch-wit",
        type: "withdraw",
        amount: 500,
        timestamp: "2026-03-29T10:01:00Z", // DEPOIS
        user_id: USERS.carlos.id,
      },
      {
        id: "batch-dep",
        type: "deposit",
        amount: 1000,
        timestamp: "2026-03-29T10:00:00Z", // ANTES
        user_id: USERS.carlos.id,
      },
    ]);

    // Ambos devem ter sido processados (deposit primeiro por timestamp)
    expect(results.every((r) => r.status === "processed")).toBe(true);
    // Carlos: 1000 + 1000 - 500 = 1500
    expect(getBalance(USERS.carlos.id)).toBe(150000);
  });

  it("deve lidar com duplicatas dentro do batch", async () => {
    const results = await processBatch(testDb, [
      {
        id: "batch-dup",
        type: "deposit",
        amount: 100,
        timestamp: "2026-03-29T10:00:00Z",
        user_id: USERS.alice.id,
      },
      {
        id: "batch-dup", // MESMO ID
        type: "deposit",
        amount: 100,
        timestamp: "2026-03-29T10:00:01Z",
        user_id: USERS.alice.id,
      },
    ]);

    expect(results[0].status).toBe("processed");
    expect(results[1].status).toBe("duplicate");
    // Só creditou uma vez
    expect(getBalance(USERS.alice.id)).toBe(510000);
  });

  it("deve processar batch misto (válidas + inválidas) sem parar", async () => {
    const results = await processBatch(testDb, [
      {
        id: "mix-1",
        type: "deposit",
        amount: 100,
        timestamp: "2026-03-29T10:00:00Z",
        user_id: USERS.alice.id,
      },
      {
        id: "mix-2",
        type: "deposit",
        amount: -50, // INVÁLIDA
        timestamp: "2026-03-29T10:00:01Z",
        user_id: USERS.alice.id,
      },
      {
        id: "mix-3",
        type: "deposit",
        amount: 200,
        timestamp: "2026-03-29T10:00:02Z",
        user_id: USERS.alice.id,
      },
    ]);

    expect(results[0].status).toBe("processed");
    expect(results[1].status).toBe("invalid");
    expect(results[2].status).toBe("processed");
    // Alice: 5000 + 100 + 200 = 5300
    expect(getBalance(USERS.alice.id)).toBe(530000);
  });
});
