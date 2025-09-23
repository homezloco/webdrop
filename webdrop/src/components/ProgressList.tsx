"use client";

type Item = {
  id: string;
  name: string;
  size: number;
  transferred: number;
  done: boolean;
  error?: string;
};

export default function ProgressList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-2">
      {items.map((it) => {
        const pct = it.size > 0 ? Math.round((it.transferred / it.size) * 100) : (it.done ? 100 : 0);
        return (
          <li key={it.id} className="border rounded p-3">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="font-medium truncate">{it.name}</p>
                <p className="text-xs text-neutral-500">{fmtBytes(it.transferred)} / {fmtBytes(it.size)} ({pct}%)</p>
              </div>
              <div className="text-xs text-neutral-600">{it.done ? "Done" : it.error ? "Error" : "Transferring"}</div>
            </div>
            <div className="h-2 bg-neutral-200 rounded mt-2 overflow-hidden">
              <div className="h-2 bg-black" style={{ width: `${pct}%` }} />
            </div>
            {it.error && <p className="text-xs text-red-600 mt-1">{it.error}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function fmtBytes(n: number) {
  if (!isFinite(n)) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"] as const;
  let u = 0;
  let v = n;
  while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
  return `${v.toFixed(1)} ${units[u]}`;
}
