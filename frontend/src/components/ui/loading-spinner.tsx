interface LoadingSpinnerProps {
  text?: string;
}

export default function LoadingSpinner({
  text = "Cargando...",
}: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12" role="status" aria-live="polite" aria-label={text}>
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-dark-600 border-t-primary-500" />
      {text && <p className="mt-4 text-sm text-dark-400">{text}</p>}
    </div>
  );
}
