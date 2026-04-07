import type { ChangeEvent } from "react";
import FormField from "./form-field";

interface FormTextareaProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  rows?: number;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function FormTextarea({
  label,
  name,
  value,
  onChange,
  rows = 4,
  error,
  placeholder,
  required = false,
  disabled = false,
}: FormTextareaProps) {
  return (
    <FormField label={label} name={name} error={error} required={required}>
      <textarea
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`input-field resize-vertical ${
          error ? "border-red-500 focus:ring-red-500" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </FormField>
  );
}
