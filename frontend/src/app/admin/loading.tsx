export default function Loading() {
  return (
    <div>
      <div className="h-8 w-64 bg-dark-800 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-dark-800 border border-dark-700 rounded-xl p-6 animate-pulse">
            <div className="h-3 w-20 bg-dark-700 rounded mb-3" />
            <div className="h-8 w-16 bg-dark-700 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 animate-pulse">
        <div className="h-5 w-40 bg-dark-700 rounded mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 w-full bg-dark-700 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
