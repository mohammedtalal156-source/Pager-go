/** Instant feedback while a page loads (shown on every navigation). */
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="جارٍ التحميل">
      <div className="mb-5 h-8 w-48 rounded-lg bg-muted" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-muted" />
        ))}
      </div>
      <div className="mt-4 grid gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}
