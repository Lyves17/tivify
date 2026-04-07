import type { ChangeEvent } from "react";
import FormField from "./form-field";

interface FormInputProps {
  label: string;
  name: string;
  type?: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}

export default function FormInput({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
}: FormInputProps) {
  return (
    <FormField label={label} name={name} error={error} required={required}>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`input-field ${
          error ? "border-red-500 focus:ring-red-500" : ""
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
    </FormField>
  );
}
