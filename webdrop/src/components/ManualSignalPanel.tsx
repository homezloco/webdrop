"use client";

import { useEffect, useRef, useState } from "react";
import { applyRemoteDescription, createPeer, makeAnswer, makeOffer, onIceCandidate, PeerSide } from "@/lib/webrtc";

type Props = {
  mode: "host" | "guest";
  onConnected?: () => void;
};

// Manual signaling (copy/paste SDP). This is a degraded fallback when WS signaling isn't available.
export default function ManualSignalPanel({ mode, onConnected }: Props) {
  const [localSdp, setLocalSdp] = useState<string>("");
  const [remoteSdp, setRemoteSdp] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");

  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const { pc } = createPeer(mode);
    pcRef.current = pc;
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") onConnected?.();
    };

    return () => {
      try { pcRef.current?.close(); } catch {}
      pcRef.current = null;
    };
  }, [mode]);

  async function createLocalOffer() {
    if (!pcRef.current) return;
    setStatus("gathering");
    const pc = pcRef.current;
    // Gather ICE fully before presenting SDP to user
    const finished = waitForIceComplete(pc);
    const offer = await makeOffer(pc);
    await finished;
    setLocalSdp(JSON.stringify(pc.localDescription));
    setStatus("offer_ready");
  }

  async function acceptRemoteOfferAndCreateAnswer() {
    if (!pcRef.current) return;
    setStatus("applying_remote_offer");
    const pc = pcRef.current;
    const sdp = JSON.parse(remoteSdp) as RTCSessionDescriptionInit;
    await applyRemoteDescription(pc, sdp);
    setStatus("gathering_answer");
    const finished = waitForIceComplete(pc);
    const answer = await makeAnswer(pc);
    await finished;
    setLocalSdp(JSON.stringify(pc.localDescription));
    setStatus("answer_ready");
  }

  async function acceptRemoteAnswer() {
    if (!pcRef.current) return;
    setStatus("applying_remote_answer");
    const pc = pcRef.current;
    const sdp = JSON.parse(remoteSdp) as RTCSessionDescriptionInit;
    await applyRemoteDescription(pc, sdp);
    setStatus("waiting_connect");
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <h3 className="font-medium">Manual signaling (fallback)</h3>
      <p className="text-xs text-neutral-600">Use this only if the QR/link method fails. Copy/paste the JSON below between devices.</p>
      <p className="text-xs text-neutral-500">Status: {status}</p>

      {mode === "host" ? (
        <div className="space-y-2">
          <button className="px-3 py-1 rounded border hover:bg-neutral-100" onClick={createLocalOffer}>Create Offer</button>
          <label className="block text-xs font-medium">Your Offer (copy this)</label>
          <textarea className="w-full h-28 border rounded p-2 text-xs" value={localSdp} readOnly />
          <label className="block text-xs font-medium mt-2">Remote Answer (paste here)</label>
          <textarea className="w-full h-28 border rounded p-2 text-xs" value={remoteSdp} onChange={(e) => setRemoteSdp(e.target.value)} />
          <div className="flex justify-end">
            <button className="px-3 py-1 rounded border hover:bg-neutral-100" onClick={acceptRemoteAnswer}>Apply Remote Answer</button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <label className="block text-xs font-medium">Remote Offer (paste here)</label>
          <textarea className="w-full h-28 border rounded p-2 text-xs" value={remoteSdp} onChange={(e) => setRemoteSdp(e.target.value)} />
          <div className="flex justify-end">
            <button className="px-3 py-1 rounded border hover:bg-neutral-100" onClick={acceptRemoteOfferAndCreateAnswer}>Create Answer</button>
          </div>
          <label className="block text-xs font-medium">Your Answer (copy this)</label>
          <textarea className="w-full h-28 border rounded p-2 text-xs" value={localSdp} readOnly />
        </div>
      )}
    </div>
  );
}

function waitForIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    function check() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    pc.addEventListener('icegatheringstatechange', check);
    // Fallback timeout in case the browser never reports 'complete'
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 5000);
  });
}
