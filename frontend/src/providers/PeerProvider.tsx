import React, {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef
} from "react";

/* ---------------- TYPES ---------------- */

interface Message {
  id: string;
  sender: string;
  text: string;
  time: string;
  type: 'text' | 'system';
}

interface PeerContextType {
  peer: RTCPeerConnection;
  createOffer: () => Promise<RTCSessionDescriptionInit>;
  createAnswers: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>;
  setRemoteAns: (ans: RTCSessionDescriptionInit) => Promise<void>;
  sendStream: (stream: MediaStream) => void;
  remoteStream: MediaStream | null;
  // Data Channel Methods
  sendMessage: (message: Omit<Message, 'id' | 'time'>) => void;
  messages: Message[];
  dataChannelReady: boolean;
  initializeDataChannel: () => void;
}

interface PeerProviderProps {
  children: ReactNode;
}

/* ---------------- CONTEXT ---------------- */

const PeerContext = createContext<PeerContextType | null>(null);

/* ---------------- HOOK ---------------- */

export const usePeer = (): PeerContextType => {
  const context = useContext(PeerContext);

  if (!context) {
    throw new Error("usePeer must be used inside PeerProvider");
  }

  return context;
};

/* ---------------- PROVIDER ---------------- */

export const PeerProvider: React.FC<PeerProviderProps> = ({ children }) => {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dataChannelReady, setDataChannelReady] = useState(false);
  
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const pendingMessagesRef = useRef<Omit<Message, 'id' | 'time'>[]>([]);

  const peer = useMemo(() => {
    return new RTCPeerConnection({
      iceServers: [
        {
          urls: [
            "stun:stun.l.google.com:19302",
            "stun:global.stun.twilio.com:3478"
          ]
        }
      ]
    });
  }, []);

  // Initialize data channel when peer is created
  const initializeDataChannel = useCallback(() => {
    if (dataChannelRef.current) return;

    // Create data channel
    const dataChannel = peer.createDataChannel("chat", {
      ordered: true,
      maxRetransmits: 3
    });

    setupDataChannel(dataChannel);
    dataChannelRef.current = dataChannel;
  }, [peer]);

  // Handle incoming data channel
  useEffect(() => {
    const handleDataChannel = (event: RTCDataChannelEvent) => {
      console.log("Received data channel:", event.channel);
      setupDataChannel(event.channel);
      dataChannelRef.current = event.channel;
    };

    peer.addEventListener("datachannel", handleDataChannel);

    return () => {
      peer.removeEventListener("datachannel", handleDataChannel);
    };
  }, [peer]);

  // Setup data channel event handlers
  const setupDataChannel = (channel: RTCDataChannel) => {
    channel.onopen = () => {
      console.log("Data channel opened");
      setDataChannelReady(true);
      
      // Send any pending messages
      pendingMessagesRef.current.forEach(msg => {
        sendMessageInternal(msg);
      });
      pendingMessagesRef.current = [];
    };

    channel.onclose = () => {
      console.log("Data channel closed");
      setDataChannelReady(false);
    };

    channel.onerror = (error) => {
      console.error("Data channel error:", error);
    };

    channel.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message:", data);
        
        const newMessage: Message = {
          id: `msg-${Date.now()}-${Math.random()}`,
          sender: data.sender,
          text: data.text,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: data.type || 'text'
        };
        
        setMessages(prev => [...prev, newMessage]);
      } catch (error) {
        console.error("Error parsing message:", error);
      }
    };
  };

  // Internal send message function
  const sendMessageInternal = (message: Omit<Message, 'id' | 'time'>) => {
    if (dataChannelRef.current?.readyState === 'open') {
      try {
        dataChannelRef.current.send(JSON.stringify(message));
        console.log("Message sent:", message);
      } catch (error) {
        console.error("Error sending message:", error);
      }
    } else {
      console.log("Data channel not ready, queueing message");
      pendingMessagesRef.current.push(message);
    }
  };

  // Public send message function
  const sendMessage = useCallback((message: Omit<Message, 'id' | 'time'>) => {
    // Add to local messages immediately
    const newMessage: Message = {
      id: `msg-${Date.now()}-${Math.random()}`,
      sender: message.sender,
      text: message.text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: message.type || 'text'
    };
    
    setMessages(prev => [...prev, newMessage]);
    
    // Send via data channel
    sendMessageInternal(message);
  }, []);

  /* ---------------- OFFER ---------------- */

  const createOffer = async (): Promise<RTCSessionDescriptionInit> => {
    // Initialize data channel if not already done
    if (!dataChannelRef.current) {
      initializeDataChannel();
    }

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    return offer;
  };

  /* ---------------- ANSWER ---------------- */

  const createAnswers = async (
    offer: RTCSessionDescriptionInit
  ): Promise<RTCSessionDescriptionInit> => {
    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    return answer;
  };

  /* ---------------- SET REMOTE ANSWER ---------------- */

  const setRemoteAns = async (ans: RTCSessionDescriptionInit): Promise<void> => {
    await peer.setRemoteDescription(new RTCSessionDescription(ans));
  };

  /* ---------------- SEND STREAM ---------------- */

  const sendStream = (stream: MediaStream): void => {
    const senders = peer.getSenders();
    stream.getTracks().forEach(track => {
      const alreadyExists = senders.find(sender => sender.track?.kind === track.kind);
      if (!alreadyExists) {
        peer.addTrack(track, stream);
      }
    });
  };

  /* ---------------- RECEIVE STREAM ---------------- */

  const handleTrackEvent = useCallback((event: RTCTrackEvent) => {
    const streams = event.streams;
    if (streams && streams[0]) {
      setRemoteStream(streams[0]);
    }
  }, []);

  useEffect(() => {
    peer.addEventListener("track", handleTrackEvent);
    return () => {
      peer.removeEventListener("track", handleTrackEvent);
    };
  }, [peer, handleTrackEvent]);

  /* ---------------- PROVIDER ---------------- */

  return (
    <PeerContext.Provider
      value={{
        peer,
        createOffer,
        createAnswers,
        setRemoteAns,
        sendStream,
        remoteStream,
        sendMessage,
        messages,
        dataChannelReady,
        initializeDataChannel
      }}
    >
      {children}
    </PeerContext.Provider>
  );
};