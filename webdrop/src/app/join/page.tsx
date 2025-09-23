export default function ReceiveLanding() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-xl w-full space-y-4">
        <h1 className="text-2xl font-semibold">Receive</h1>
        <p className="text-neutral-600">
          Ask the sender to show their QR, then scan it with this device.
          The QR opens a URL like <code>/join/&lt;roomId&gt;?token=...</code> which connects you securely.
        </p>
        <p className="text-sm text-neutral-500">
          If you have a join link already, open it directly. Rooms expire after 5 minutes.
        </p>
      </div>
    </div>
  );
}
