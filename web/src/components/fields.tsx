/**
 * Input primitives.
 *
 * `Derived` is the only way a computed number reaches the screen: it takes a value it is handed
 * and renders it. Nothing in this file — or anywhere else in the frontend — does rules
 * arithmetic. Once a formula exists in both Python and TypeScript the two drift, and the result
 * is a sheet that is right on one screen and wrong on another.
 */
import type { ReactNode } from "react";

export function signed(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  wide?: boolean;
}

export function TextField({ label, value, onChange, placeholder, wide }: TextFieldProps) {
  return (
    <label className={wide === true ? "field field--wide" : "field"}>
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  compact?: boolean;
}

export function NumberField({ label, value, onChange, min, max, compact }: NumberFieldProps) {
  return (
    <label className={compact === true ? "field field--compact" : "field"}>
      <span className="field__label">{label}</span>
      <input
        className="field__input field__input--number"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          onChange(Number.isFinite(parsed) ? parsed : 0);
        }}
      />
    </label>
  );
}

interface OptionalNumberFieldProps {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
}

/** For the sheet's TEMPORARY SCORE column and armour's MAX DEX: blank is a real value. */
export function OptionalNumberField({
  label,
  value,
  onChange,
  min,
  max,
}: OptionalNumberFieldProps) {
  return (
    <label className="field field--compact">
      <span className="field__label">{label}</span>
      <input
        className="field__input field__input--number"
        type="number"
        value={value ?? ""}
        min={min}
        max={max}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" ? null : Number(raw));
        }}
      />
    </label>
  );
}

interface DecimalFieldProps {
  label: string;
  /** Decimals cross the wire as strings so no precision is lost; the draft holds them verbatim. */
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}

export function DecimalField({ label, value, onChange, compact }: DecimalFieldProps) {
  return (
    <label className={compact === true ? "field field--compact" : "field"}>
      <span className="field__label">{label}</span>
      <input
        className="field__input field__input--number"
        type="text"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

interface DerivedProps {
  label: string;
  value: ReactNode;
  title?: string;
  emphasis?: boolean;
}

/** A computed value. Read-only by construction — there is nowhere to type into it. */
export function Derived({ label, value, title, emphasis }: DerivedProps) {
  return (
    <div className={emphasis === true ? "derived derived--total" : "derived"} title={title}>
      <span className="derived__label">{label}</span>
      <output className="derived__value" aria-label={label}>
        {value}
      </output>
    </div>
  );
}

export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className === undefined ? "panel" : `panel ${className}`}>
      <h2 className="panel__title">{title}</h2>
      <div className="panel__body">{children}</div>
    </section>
  );
}
