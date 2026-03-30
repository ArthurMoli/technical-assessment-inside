import { useState, useRef, useEffect } from "react";

interface CurrencyInputProps {
  name: string;
  id?: string;
  required?: boolean;
}

function formatBRL(cents: number): string {
  if (cents === 0) return "0,00";
  const reais = Math.floor(cents / 100);
  const centavos = cents % 100;
  const reaisStr = reais.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${reaisStr},${centavos.toString().padStart(2, "0")}`;
}

function centsToFloat(cents: number): number {
  return cents / 100;
}

export default function CurrencyInput({ name, id, required }: CurrencyInputProps) {
  const [cents, setCents] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    // Allow: tab, backspace, delete, arrows
    if (["Tab", "ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return;

    e.preventDefault();

    if (e.key === "Backspace" || e.key === "Delete") {
      setCents((prev) => Math.floor(prev / 10));
      return;
    }

    const digit = parseInt(e.key);
    if (isNaN(digit)) return;

    setCents((prev) => {
      const next = prev * 10 + digit;
      // Limit to 999.999.999,99 (prevent overflow)
      if (next > 99999999999) return prev;
      return next;
    });
  }

  return (
    <div className="currency-input-wrapper">
      <span className="currency-prefix">R$</span>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        id={id}
        className="currency-input"
        value={formatBRL(cents)}
        onKeyDown={handleKeyDown}
        onChange={() => {}} // controlled
        required={required}
        placeholder="0,00"
        autoComplete="off"
      />
      {/* Hidden input com o valor real em float pra submissão do form */}
      <input type="hidden" name={name} value={cents === 0 ? "" : centsToFloat(cents)} />
    </div>
  );
}
