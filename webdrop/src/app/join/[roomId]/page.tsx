"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { SignalingClient, signalingUrlFromEnv } from "@/lib/signaling";
import { AnyInbound } from "@/lib/schemas";
import { applyRemoteDescription, createPeer, makeAnswer, onIceCandidate } from "@/lib/webrtc";
import ProgressList from "@/components/ProgressList";
import ManualSignalPanel from "@/components/ManualSignalPanel";
import TurnNotice from "@/components/TurnNotice";
import { useToast } from "@/components/ToastProvider";
import TransferStats from "@/components/TransferStats";

export default function JoinPage() {
  const { show } = useToast();
  const params = useParams<{ roomId: string }>();
  const search = useSearchParams();
  const token = search.get("token");
  const roomId = params.roomId;

  const [status, setStatus] = useState("initializing");
  const [items, setItems] = useState<{ id: string; name: string; size: number; type: string; transferred: number; done: boolean; url?: string }[]>([]);
  const [showManual, setShowManual] = useState<boolean>(false);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const signaling = useRef<SignalingClient | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!roomId || !token) { setStatus("missing_room_or_token"); return; }

    const receivedChunks: Uint8Array[] = [];
    let currentMeta: { id: string; name: string; size: number; type: string } | null = null;

    const sig = new SignalingClient(signalingUrlFromEnv(), {
      onOpen: () => {
        setStatus("signaling_connected");
        sig.joinRoom(roomId, token);
      },
      onClose: () => setStatus("signaling_closed"),
      onError: (e) => {
        setStatus("signaling_error");
        show({ variant: "error", title: "Signaling error", message: (e as Error)?.message || "WebSocket error" });
      },
      onReconnectAttempt: (attempt, delayMs) => {
        setStatus("reconnecting");
        show({ variant: "warning", title: "Reconnecting", message: `Attempt ${attempt} in ${Math.ceil(delayMs/1000)}s…` });
      },
      onReconnectSuccess: () => {
        setStatus("signaling_connected");
        show({ variant: "success", title: "Reconnected", message: "Signaling connection restored." });
      },
      onReconnectGiveUp: (attempts) => {
        setStatus("signaling_error");
        show({ variant: "error", title: "Connection lost", message: `Unable to reconnect after ${attempts} attempts.` });
        setShowManual(true);
      },
      onMessage: async (msg: AnyInbound) => {
        if (msg.type === "room_joined") {
          setStatus("joined");
          const { pc, getChannel } = createPeer("guest");
          peerRef.current = pc;
          onIceCandidate(pc, (c) => sig.signal(roomId, { candidate: c }));
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") setStatus("connected");
          };
          const dc = getChannel();
          if (dc) {
            dc.onmessage = (e) => {
              const data = e.data as ArrayBuffer | string;
              if (typeof data === "string") {
                if (data === "__EOF__" && currentMeta) {
                  const parts: BlobPart[] = receivedChunks.map((u) => u.slice());
                  const blob = new Blob(parts, { type: currentMeta.type || "application/octet-stream" });
                  const url = URL.createObjectURL(blob);
                  setItems((prev) => prev.map((it) => it.id === currentMeta!.id ? { ...it, done: true, transferred: it.size, url } : it));
                  // reset for next file
                  receivedChunks.length = 0;
                  currentMeta = null;
                  return;
                }
                try {
                  const meta = JSON.parse(data);
                  if (meta?.name && meta?.size != null) {
                    const id = `${meta.name}-${Date.now()}`;
                    currentMeta = { id, name: meta.name, size: meta.size, type: meta.type || "" };
                    setItems((prev) => [...prev, { id, name: meta.name, size: meta.size, type: meta.type || "", transferred: 0, done: false }]);
                    if (!startedAt) setStartedAt(Date.now());
                    return;
                  }
                } catch { /* ignore non-json */ }
              } else if (data instanceof ArrayBuffer) {
                receivedChunks.push(new Uint8Array(data));
                setBytesReceived((b) => b + (data.byteLength || 0));
                if (currentMeta) {
                  setItems((prev) => prev.map((it) => it.id === currentMeta!.id ? { ...it, transferred: Math.min(it.transferred + (data.byteLength || 0), it.size) } : it));
                }
              }
            };
          }
        } else if (msg.type === "signal" && peerRef.current) {
          const data = msg.payload.data as any;
          if (data?.sdp) {
            await applyRemoteDescription(peerRef.current, data.sdp);
            const answer = await makeAnswer(peerRef.current);
            sig.signal(roomId, { sdp: answer });
          } else if (data?.candidate) {
            try { await peerRef.current.addIceCandidate(data.candidate); } catch { /* ignore */ }
          }
        } else if (msg.type === "ended" || msg.type === "expired") {
          setStatus("ended");
          try { peerRef.current?.close(); } catch {}
        }
      },
    });
    sig.connect();
    signaling.current = sig;

    // Heartbeat while connected
    const hb = setInterval(() => {
      try { sig.heartbeat(roomId); } catch { /* ignore */ }
    }, 20000);

    return () => {
      try { peerRef.current?.close(); } catch {}
      sig.close();
      clearInterval(hb);
    };
  }, [roomId, token]);

  function endSession() {
    if (signaling.current) {
      try { signaling.current.endRoom(roomId); } catch { /* ignore */ }
    }
    try { peerRef.current?.close(); } catch {}
    setStatus("ended");
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <TurnNotice />
      <h1 className="text-2xl font-semibold">WebDrop — Receive</h1>
      <p className="text-sm text-neutral-500">Status: {status}</p>
      <div className="flex justify-end">
        <button onClick={() => setShowManual((v) => !v)} className="text-xs px-2 py-1 rounded border hover:bg-neutral-100">Advanced</button>
      </div>
      {(status === "signaling_error" || showManual) && (
        <ManualSignalPanel mode="guest" onConnected={() => setStatus("connected")} />
      )}
      {items.length === 0 ? <p className="text-neutral-600">Waiting for files…</p> : (
        <>
          <ProgressList items={items.map(({ id, name, size, transferred, done }) => ({ id, name, size, transferred, done })) as any} />
          <div className="mt-3">
            <TransferStats totalBytes={bytesReceived} sinceTs={startedAt} label="Received" />
          </div>
        </>
      )}
      {items.some((it) => it.url) && (
        <div>
          <h2 className="font-medium mt-4">Ready to save</h2>
          <ul className="space-y-2 mt-2">
            {items.filter((i) => i.url).map((it) => (
              <li key={it.id} className="flex items-center justify-between border rounded p-3">
                <div>
                  <p className="font-medium">{it.name}</p>
                  <p className="text-xs text-neutral-500">{it.type || "unknown"}</p>
                </div>
                <a href={it.url!} download={it.name} className="px-3 py-1 rounded bg-black text-white text-sm">Save</a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={endSession} className="text-sm px-3 py-1 rounded border hover:bg-neutral-100">End Session</button>
      </div>
    </div>
  );
}
