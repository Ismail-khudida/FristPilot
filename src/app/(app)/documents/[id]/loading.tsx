export default function DocumentLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="space-y-2">
        <div className="h-3 w-28 rounded bg-gray-200" />
        <div className="h-7 w-72 rounded-lg bg-gray-200" />
        <div className="h-3 w-40 rounded bg-gray-100" />
      </div>
      <div className="card space-y-4">
        <div className="flex gap-2">
          <div className="h-6 w-24 rounded-full bg-gray-200" />
          <div className="h-6 w-32 rounded-full bg-gray-200" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="h-4 w-4/5 rounded bg-gray-200" />
          <div className="h-4 w-3/5 rounded bg-gray-200" />
        </div>
      </div>
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="card space-y-3">
            <div className="h-6 w-32 rounded-full bg-gray-200" />
            <div className="h-8 w-40 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
