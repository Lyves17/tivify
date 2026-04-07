export default function Loading() {
  return (
    <div>
      <div className="h-8 w-48 bg-dark-800 rounded animate-pulse mb-6" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-dark-800 border border-dark-700 rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-lg bg-dark-700" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-dark-700 rounded" />
                <div className="h-3 w-1/2 bg-dark-700 rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
