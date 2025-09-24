"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "react-qr-code";
import { SignalingClient, signalingUrlFromEnv } from "@/lib/signaling";
import { AnyInbound } from "@/lib/schemas";
import { createPeer, makeOffer, onIceCandidate, applyRemoteDescription, PeerSide } from "@/lib/webrtc";
import Timer from "@/components/Timer";
import ProgressList from "@/components/ProgressList";
import ManualSignalPanel from "@/components/ManualSignalPanel";
import TurnNotice from "@/components/TurnNotice";
import { useToast } from "@/components/ToastProvider";
import TransferStats from "@/components/TransferStats";

export default function HostPage() {
  const { show } = useToast();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [status, setStatus] = useState<string>("initializing");
  const [items, setItems] = useState<{ id: string; name: string; size: number; transferred: number; done: boolean; error?: string }[]>([]);
  const [showManual, setShowManual] = useState<boolean>(false);
  const signaling = useRef<SignalingClient | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<RTCDataChannel | null>(null);
  const [bytesSent, setBytesSent] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [backpressure, setBackpressure] = useState(false);

  const joinUrl = useMemo(() => {
    if (!roomId || !token) return "";
    const url = new URL(window.location.origin + "/join/" + roomId);
    url.searchParams.set("token", token);
    return url.toString();
  }, [roomId, token]);

  useEffect(() => {
    const sig = new SignalingClient(signalingUrlFromEnv(), {
      onOpen: () => {
        setStatus("signaling_connected");
        sig.createRoom();
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
        if (msg.type === "room_created") {
          setRoomId(msg.payload.roomId);
          setToken(msg.payload.joinToken);
          setExpiresAt(msg.payload.expiresAt);
          setStatus("waiting_for_guest");
        } else if (msg.type === "guest_joined" && roomId && !peerRef.current) {
          setStatus("guest_joined");
          const { pc, getChannel } = createPeer("host");
          peerRef.current = pc;
          channelRef.current = getChannel();
          onIceCandidate(pc, (c) => sig.signal(roomId, { candidate: c }));
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") setStatus("connected");
          };
          const offer = await makeOffer(pc);
          sig.signal(roomId, { sdp: offer });
        } else if (msg.type === "signal" && roomId && peerRef.current) {
          const data = msg.payload.data as any;
          if (data?.sdp) {
            await applyRemoteDescription(peerRef.current, data.sdp);
          } else if (data?.candidate) {
            try { await peerRef.current.addIceCandidate(data.candidate); } catch { /* ignore */ }
          }
        } else if (msg.type === "ended" || msg.type === "expired") {
          setStatus("ended");
          cleanup();
        }
      },
    });
    sig.connect();
    signaling.current = sig;
    // Heartbeat to extend TTL while active
    const hb = setInterval(() => {
      if (roomId) {
        try { sig.heartbeat(roomId); } catch { /* ignore */ }
      }
    }, 20000);

    return () => {
      cleanup();
      sig.close();
      clearInterval(hb);
    };
  }, []);

  function cleanup() {
    try { channelRef.current?.close(); } catch {}
    try { peerRef.current?.close(); } catch {}
    channelRef.current = null;
    peerRef.current = null;
  }

  function onDropFiles(files: FileList | null) {
    if (!files || !channelRef.current) return;
    const dc = channelRef.current;
    if (!startedAt) setStartedAt(Date.now());
    for (const file of Array.from(files)) {
      const reader = file.stream().getReader();
      const header = JSON.stringify({ name: file.name, size: file.size, type: file.type });
      const id = `${file.name}-${Date.now()}`;
      setItems((prev) => [...prev, { id, name: file.name, size: file.size, transferred: 0, done: false }]);
      dc.send(header);
      // update telemetry for header
      setBytesSent((b) => b + new Blob([header]).size);
      const pump = (): Promise<void> =>
        reader.read().then(({ done, value }): Promise<void> => {
          if (done) {
            dc.send("__EOF__");
            setBytesSent((b) => b + new Blob(["__EOF__"]).size);
            setItems((prev) => prev.map((it) => it.id === id ? { ...it, transferred: it.size, done: true } : it));
            return Promise.resolve();
          }
          if (value) {
            try {
              dc.send(value);
              setBytesSent((b) => b + value.byteLength);
              const buffered = dc.bufferedAmount || 0;
              setBackpressure(buffered > 1_000_000); // ~1MB buffer threshold
            } catch (e) {
              setItems((prev) => prev.map((it) => it.id === id ? { ...it, error: 'send_error' } : it));
              return Promise.resolve();
            }
            setItems((prev) => prev.map((it) => it.id === id ? { ...it, transferred: Math.min(it.transferred + value.byteLength, it.size) } : it));
          }
          return pump();
        });
      void pump();
    }
  }

  function endSession() {
    if (roomId && signaling.current) {
      try { signaling.current.endRoom(roomId); } catch { /* ignore */ }
    }
    cleanup();
    setStatus("ended");
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <TurnNotice />
      <h1 className="text-2xl font-semibold">WebDrop — Send</h1>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">Status: {status}</p>
        <div>{expiresAt ? <Timer expiresAt={expiresAt} /> : null}</div>
      </div>
      <div className="flex justify-end">
        <button onClick={() => setShowManual((v) => !v)} className="text-xs px-2 py-1 rounded border hover:bg-neutral-100">Advanced</button>
      </div>
      {joinUrl ? (
        <div className="flex flex-col items-center gap-3">
          <QRCode value={joinUrl} size={180} />
          <code className="text-xs break-all p-2 bg-neutral-100 rounded w-full text-center">{joinUrl}</code>
          <button
            onClick={() => { navigator.clipboard?.writeText(joinUrl); show({ variant: "success", message: "Join link copied" }); }}
            className="text-xs px-2 py-1 rounded border hover:bg-neutral-100"
            aria-label="Copy join link"
          >Copy Link</button>
          {roomId ? (
            <div className="w-full text-center space-y-1 mt-2">
              <div className="text-xs text-neutral-500">Room code</div>
              <code className="text-xs p-2 bg-neutral-100 rounded w-full inline-block">{roomId}</code>
              <div>
                <button
                  onClick={() => { navigator.clipboard?.writeText(roomId); show({ variant: "success", message: "Room code copied" }); }}
                  className="text-xs px-2 py-1 rounded border hover:bg-neutral-100"
                  aria-label="Copy room code"
                >Copy Room Code</button>
              </div>
            </div>
          ) : null}
          {expiresAt && (
            <p className="text-xs text-neutral-500">Expires at: {new Date(expiresAt).toLocaleTimeString()}</p>
          )}
        </div>
      ) : (
        <p>Preparing room…</p>
      )}
      {(status === "signaling_error" || showManual) && (
        <ManualSignalPanel mode="host" onConnected={() => setStatus("connected")} />
      )}
      <div
        className="border-2 border-dashed rounded p-8 text-center text-neutral-500"
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); onDropFiles(e.dataTransfer.files); }}
      >
        Drag & drop files here after the receiver connects
      </div>
      {items.length > 0 && (
        <div>
          <h2 className="font-medium">Transfers</h2>
          <ProgressList items={items} />
          <div className="mt-3">
            <TransferStats totalBytes={bytesSent} sinceTs={startedAt} label="Sent" backpressure={backpressure} />
          </div>
        </div>
      )}
      <div className="flex justify-end">
        <button onClick={endSession} className="text-sm px-3 py-1 rounded border hover:bg-neutral-100">End Session</button>
      </div>
    </div>
  );
}
