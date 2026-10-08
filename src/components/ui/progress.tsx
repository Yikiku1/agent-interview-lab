export function Progress({ value, label }: { value: number; label: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bounded}
      className="progress-track"
    >
      <div className="progress-fill" style={{ width: `${bounded}%` }} />
    </div>
  );
}
