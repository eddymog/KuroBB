import type { ReactNode } from "react";

// STYLE.md §5 "Forms" — label above input, error slot below. Deliberately not
// a full HTMLAttributes passthrough wrapper (that fights TypeScript's
// discriminated unions for little benefit at this project's actual usage);
// just the handful of props every real form in this codebase actually uses.
interface FieldBase {
  name: string;
  label: string;
  error?: string;
  required?: boolean;
  defaultValue?: string | number;
  placeholder?: string;
}

interface InputField extends FieldBase {
  as?: "input";
  type?: "text" | "email" | "password" | "url" | "number";
  minLength?: number;
}

interface TextareaField extends FieldBase {
  as: "textarea";
}

interface SelectField extends FieldBase {
  as: "select";
  children: ReactNode;
}

export type FieldProps = InputField | TextareaField | SelectField;

const controlClasses = "w-full border border-border bg-surface px-3 py-2 text-sm text-ink";

export function Field(props: FieldProps) {
  const { name, label, error, required, defaultValue, placeholder } = props;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="text-sm text-ink-muted">
        {label}
      </label>
      {props.as === "textarea" ? (
        <textarea
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={`${controlClasses} min-h-32`}
        />
      ) : props.as === "select" ? (
        <select
          id={name}
          name={name}
          required={required}
          defaultValue={defaultValue}
          className={controlClasses}
        >
          {props.children}
        </select>
      ) : (
        <input
          id={name}
          name={name}
          type={props.type ?? "text"}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          minLength={props.minLength}
          className={controlClasses}
        />
      )}
      {error && <p className="text-sm text-accent">{error}</p>}
    </div>
  );
}
