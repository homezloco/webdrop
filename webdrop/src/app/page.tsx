import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-6">
        <h1 className="text-3xl font-semibold">WebDrop</h1>
        <p className="text-neutral-600">Beam files or text between any two browsers. No account. P2P via WebRTC. Rooms expire after 5 minutes.</p>
        <div className="flex gap-3">
          <Link href="/host" className="px-4 py-2 rounded bg-black text-white hover:bg-neutral-800">Send</Link>
          <Link href="/join" className="px-4 py-2 rounded border hover:bg-neutral-100">Receive</Link>
        </div>
        <p className="text-sm text-neutral-500">Tip: Open this site on your second device and tap Receive to scan a QR from the sender.</p>
      </div>
    </div>
  );
}
