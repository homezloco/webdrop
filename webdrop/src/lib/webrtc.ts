export type PeerSide = 'host' | 'guest';

export function rtcConfigFromEnv(): RTCConfiguration {
  const stunStr = process.env.NEXT_PUBLIC_STUN_URLS || process.env.STUN_URLS;
  const stunUrls = stunStr ? stunStr.split(',').map((s) => s.trim()).filter(Boolean) : [
    'stun:stun.l.google.com:19302',
  ];
  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL || process.env.TURN_URL;
  const turnUser = process.env.NEXT_PUBLIC_TURN_USERNAME || process.env.TURN_USERNAME;
  const turnPass = process.env.NEXT_PUBLIC_TURN_PASSWORD || process.env.TURN_PASSWORD;
  const forceRelayRaw = process.env.NEXT_PUBLIC_FORCE_RELAY || process.env.FORCE_RELAY;
  const forceRelay = typeof forceRelayRaw === 'string' && /^(1|true)$/i.test(forceRelayRaw);

  const iceServers: RTCIceServer[] = [{ urls: stunUrls }];
  if (turnUrl && turnUser && turnPass) {
    iceServers.push({ urls: [turnUrl], username: turnUser, credential: turnPass });
  }
  const base: RTCConfiguration = { iceServers, iceCandidatePoolSize: 8 };
  if (forceRelay) {
    // Force relay-only for diagnostics to verify TURN connectivity
    (base as RTCConfiguration & { iceTransportPolicy?: 'all' | 'relay' }).iceTransportPolicy = 'relay';
  }
  return base;
}

export type ChannelHandlers = {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (e: unknown) => void;
  onMessage?: (data: ArrayBuffer | string) => void;
};

export function createPeer(side: PeerSide, handlers: ChannelHandlers = {}) {
  const pc = new RTCPeerConnection(rtcConfigFromEnv());
  let dc: RTCDataChannel | null = null;

  if (side === 'host') {
    dc = pc.createDataChannel('data', { ordered: true });
    attachChannel(dc, handlers);
  } else {
    pc.ondatachannel = (ev) => {
      dc = ev.channel;
      attachChannel(dc, handlers);
    };
  }

  return { pc, getChannel: () => dc };
}

function attachChannel(dc: RTCDataChannel, handlers: ChannelHandlers) {
  dc.binaryType = 'arraybuffer';
  dc.onopen = () => handlers.onOpen?.();
  dc.onclose = () => handlers.onClose?.();
  dc.onerror = (e) => handlers.onError?.(e);
  dc.onmessage = (e) => handlers.onMessage?.(e.data);
}

export async function makeOffer(pc: RTCPeerConnection) {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  return offer;
}

export async function applyRemoteDescription(pc: RTCPeerConnection, sdp: RTCSessionDescriptionInit) {
  await pc.setRemoteDescription(sdp);
}

export async function makeAnswer(pc: RTCPeerConnection) {
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  return answer;
}

export function onIceCandidate(pc: RTCPeerConnection, cb: (c: RTCIceCandidateInit) => void) {
  pc.onicecandidate = (ev) => {
    if (ev.candidate) cb(ev.candidate.toJSON());
  };
}
