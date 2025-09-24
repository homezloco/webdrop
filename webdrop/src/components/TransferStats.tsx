"use client";

import { useEffect, useMemo, useState } from "react";

export default function TransferStats({
  totalBytes,
  sinceTs,
  label = "Transfer",
  backpressure = false,
}: {
  totalBytes: number;
  sinceTs: number | null;
  label?: string;
  backpressure?: boolean;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { avgMbps, humanTotal } = useMemo(() => {
    const durSec = sinceTs ? Math.max(1, Math.floor((now - sinceTs) / 1000)) : 1;
    const mbps = totalBytes > 0 ? (totalBytes * 8) / (durSec * 1_000_000) : 0;
    const human = humanBytes(totalBytes);
    return { avgMbps: mbps, humanTotal: human };
  }, [totalBytes, sinceTs, now]);

  return (
    <div className="text-xs p-2 rounded border bg-neutral-50 text-neutral-800 flex items-center gap-3">
      <span className="font-medium">{label}</span>
      <span>{humanTotal} sent</span>
      <span>avg {avgMbps.toFixed(2)} Mbps</span>
      <span className={backpressure ? "text-red-600" : "text-green-700"}>
        Backpressure: {backpressure ? "yes" : "no"}
      </span>
    </div>
  );
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(1)} ${units[u]}`;
}
