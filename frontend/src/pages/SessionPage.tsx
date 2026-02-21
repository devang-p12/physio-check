import { usePeer } from "../providers/PeerProvider";
import { useSocket } from "../providers/socket";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Send, MessageSquare, Settings, Activity,
  Check, CheckCheck, Wifi, WifiOff, X
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Pose } from "@mediapipe/pose";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";

// Types for pose landmarks
interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

interface JointAngles {
  rightElbow: number;
  leftElbow: number;
  rightKnee: number;
  leftKnee: number;
  rightShoulder: number;
  leftShoulder: number;
  rightHip: number;
  leftHip: number;
  rightAnkle: number;
  leftAnkle: number;
}

interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  time: string;
  type: 'text' | 'system';
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

// Calculate angle between three points
const calculateAngle = (a: PoseLandmark, b: PoseLandmark, c: PoseLandmark): number => {
  if (!a || !b || !c) return 0;
  
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  
  return Math.round(angle);
};

const SessionPage = () => {
  const socket = useSocket();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteCanvasRef = useRef<HTMLCanvasElement>(null);
  const remotePoseRef = useRef<Pose | null>(null);
  const remoteAnimationFrameRef = useRef<number>();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const {
    peer,
    createOffer,
    createAnswers,
    setRemoteAns,
    sendStream,
    remoteStream,
    sendMessage,
    messages: peerMessages,
    dataChannelReady,
    initializeDataChannel
  } = usePeer();

  const navigate = useNavigate();
  const { id } = useParams(); // Session ID

  // Media Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [remoteEmailId, setRemoteEmailId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // MediaPipe State
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [jointAngles, setJointAngles] = useState<JointAngles>({
    rightElbow: 0,
    leftElbow: 0,
    rightKnee: 0,
    leftKnee: 0,
    rightShoulder: 0,
    leftShoulder: 0,
    rightHip: 0,
    leftHip: 0,
    rightAnkle: 0,
    leftAnkle: 0,
  });
  const [showAngles, setShowAngles] = useState(true);

  // Chat UI State
  const [showChat, setShowChat] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [typingStatus, setTypingStatus] = useState<{isTyping: boolean; sender: string | null}>({
    isTyping: false,
    sender: null
  });
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Get current user
  const [currentUser, setCurrentUser] = useState<string>("");

  useEffect(() => {
    // Try to get from localStorage first
    let user = localStorage.getItem("email");
    
    // If not logged in, generate a guest ID that persists for this session
    if (!user) {
      // Check if we already have a guest ID in sessionStorage
      const guestId = sessionStorage.getItem("guestId");
      if (guestId) {
        user = guestId;
      } else {
        // Generate a new guest ID
        const newGuestId = `guest-${Math.random().toString(36).substr(2, 8)}-${Date.now().toString(36)}`;
        sessionStorage.setItem("guestId", newGuestId);
        user = newGuestId;
      }
    }
    
    setCurrentUser(user);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [peerMessages]);

  // Track unread messages when chat is minimized
  useEffect(() => {
    if (!showChat && peerMessages.length > 0) {
      const lastReadMessage = localStorage.getItem(`lastRead_${id}`);
      if (lastReadMessage) {
        const newUnread = peerMessages.filter(msg => 
          msg.id > lastReadMessage && msg.sender !== 'Me'
        ).length;
        setUnreadCount(newUnread);
      } else {
        setUnreadCount(peerMessages.filter(msg => msg.sender !== 'Me').length);
      }
    } else {
      // Mark messages as read when chat is open
      if (peerMessages.length > 0) {
        localStorage.setItem(`lastRead_${id}`, peerMessages[peerMessages.length - 1].id);
        setUnreadCount(0);
      }
    }
  }, [showChat, peerMessages, id]);
  
  // Initialize data channel when peer is ready
  useEffect(() => {
    if (peer && !dataChannelReady) {
      initializeDataChannel();
    }
  }, [peer, dataChannelReady, initializeDataChannel]);

  // Handle typing indicator
  const handleTyping = useCallback((isTyping: boolean) => {
    if (dataChannelReady && remoteEmailId) {
      sendMessage({
        sender: currentUser,
        text: JSON.stringify({ type: 'typing', isTyping }),
        type: 'system'
      });
    }
  }, [dataChannelReady, remoteEmailId, sendMessage, currentUser]);

  // Handle typing input
  const handleChatInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setChatInput(e.target.value);
    
    // Send typing indicator
    if (!typingStatus.isTyping && chatInput.length === 0) {
      handleTyping(true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing indicator
    typingTimeoutRef.current = setTimeout(() => {
      handleTyping(false);
    }, 1000);
  };

  // Process incoming messages for system events
  useEffect(() => {
    const lastMessage = peerMessages[peerMessages.length - 1];
    if (lastMessage?.type === 'system') {
      try {
        const data = JSON.parse(lastMessage.text);
        if (data.type === 'typing') {
          setTypingStatus({
            isTyping: data.isTyping,
            sender: data.isTyping ? lastMessage.sender : null
          });
        }
      } catch (e) {
        // Not a system message
      }
    }
  }, [peerMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !dataChannelReady) return;
    
    // Stop typing indicator
    handleTyping(false);
    
    // Send message via data channel
    sendMessage({
      sender: 'Me',
      text: chatInput,
      type: 'text'
    });
    
    setChatInput("");
    
    // Focus back on input
    chatInputRef.current?.focus();
  };

  // Add system message when user joins
  useEffect(() => {
    if (remoteEmailId) {
      sendMessage({
        sender: 'System',
        text: `${remoteEmailId} joined the session`,
        type: 'system'
      });
    }
  }, [remoteEmailId, sendMessage]);

  // Handle pose results for remote video with physio-friendly styling
  const onRemotePoseResults = (results: any) => {
    if (!remoteCanvasRef.current || !results.poseLandmarks) return;

    const canvas = remoteCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the video frame
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    // Draw pose landmarks and connections with physio-friendly styling
    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      // Draw connections first (so they appear behind circles)
      // Using bright cyan/blue color for better visibility
      drawConnectors(ctx, landmarks, Pose.POSE_CONNECTIONS, {
        color: '#00FFFF',
        lineWidth: 3
      });
      
      // Draw landmarks with smaller circles
      drawLandmarks(ctx, landmarks, {
        color: '#0066FF',
        lineWidth: 2,
        radius: 3  // Smaller circles
      });

      // Calculate joint angles for the remote user
      const rightElbowAngle = calculateAngle(
        landmarks[12], landmarks[14], landmarks[16]
      );
      const leftElbowAngle = calculateAngle(
        landmarks[11], landmarks[13], landmarks[15]
      );
      const rightKneeAngle = calculateAngle(
        landmarks[24], landmarks[26], landmarks[28]
      );
      const leftKneeAngle = calculateAngle(
        landmarks[23], landmarks[25], landmarks[27]
      );
      const rightShoulderAngle = calculateAngle(
        landmarks[14], landmarks[12], landmarks[24]
      );
      const leftShoulderAngle = calculateAngle(
        landmarks[13], landmarks[11], landmarks[23]
      );
      const rightHipAngle = calculateAngle(
        landmarks[12], landmarks[24], landmarks[26]
      );
      const leftHipAngle = calculateAngle(
        landmarks[11], landmarks[23], landmarks[25]
      );
      const rightAnkleAngle = calculateAngle(
        landmarks[26], landmarks[28], landmarks[32]
      );
      const leftAnkleAngle = calculateAngle(
        landmarks[25], landmarks[27], landmarks[31]
      );

      setJointAngles({
        rightElbow: rightElbowAngle,
        leftElbow: leftElbowAngle,
        rightKnee: rightKneeAngle,
        leftKnee: leftKneeAngle,
        rightShoulder: rightShoulderAngle,
        leftShoulder: leftShoulderAngle,
        rightHip: rightHipAngle,
        leftHip: leftHipAngle,
        rightAnkle: rightAnkleAngle,
        leftAnkle: leftAnkleAngle,
      });

      // Draw angle labels on canvas for major joints
      if (showAngles) {
        ctx.font = 'bold 14px Arial';
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        // Only show angles for major joints to avoid clutter
        if (landmarks[14]) {
          ctx.fillText(`${rightElbowAngle}°`, landmarks[14].x * canvas.width, landmarks[14].y * canvas.height - 15);
        }
        if (landmarks[13]) {
          ctx.fillText(`${leftElbowAngle}°`, landmarks[13].x * canvas.width, landmarks[13].y * canvas.height - 15);
        }
        if (landmarks[26]) {
          ctx.fillText(`${rightKneeAngle}°`, landmarks[26].x * canvas.width, landmarks[26].y * canvas.height - 15);
        }
        if (landmarks[25]) {
          ctx.fillText(`${leftKneeAngle}°`, landmarks[25].x * canvas.width, landmarks[25].y * canvas.height - 15);
        }

        // Reset shadow
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
      }
    }
  };

  // Initialize MediaPipe Pose for remote video only
  const initializeRemotePose = useCallback(() => {
    if (!remoteVideoRef.current || !remoteCanvasRef.current || !remoteStream) return;

    try {
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onRemotePoseResults);
      remotePoseRef.current = pose;

      // Process frames manually
      const processFrame = async () => {
        if (!showSkeleton || !remoteVideoRef.current || !remotePoseRef.current) {
          remoteAnimationFrameRef.current = requestAnimationFrame(processFrame);
          return;
        }

        try {
          if (remoteVideoRef.current.readyState >= 2) {
            await remotePoseRef.current.send({ image: remoteVideoRef.current });
          }
        } catch (error) {
          console.error("Error processing remote frame:", error);
        }

        remoteAnimationFrameRef.current = requestAnimationFrame(processFrame);
      };

      // Start processing
      if (remoteAnimationFrameRef.current) {
        cancelAnimationFrame(remoteAnimationFrameRef.current);
      }
      remoteAnimationFrameRef.current = requestAnimationFrame(processFrame);

    } catch (error) {
      console.error("Error initializing remote pose:", error);
    }
  }, [remoteStream, showSkeleton]);

  // Toggle skeleton - now only for remote
  const toggleSkeleton = useCallback(() => {
    setShowSkeleton(prev => {
      const newValue = !prev;
      
      if (newValue) {
        // Turning on - initialize remote pose
        if (remoteStream && !remotePoseRef.current) {
          initializeRemotePose();
        }
      } else {
        // Turning off - cancel animation frame and close pose
        if (remoteAnimationFrameRef.current) {
          cancelAnimationFrame(remoteAnimationFrameRef.current);
          remoteAnimationFrameRef.current = undefined;
        }
        if (remotePoseRef.current) {
          remotePoseRef.current.close();
          remotePoseRef.current = null;
        }
        
        // Clear the canvas
        if (remoteCanvasRef.current) {
          const ctx = remoteCanvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, remoteCanvasRef.current.width, remoteCanvasRef.current.height);
          }
        }
      }
      
      return newValue;
    });
  }, [remoteStream, initializeRemotePose]);

  // Initialize remote pose when needed
  useEffect(() => {
    if (showSkeleton && remoteStream) {
      initializeRemotePose();
    }
    
    return () => {
      if (remoteAnimationFrameRef.current) {
        cancelAnimationFrame(remoteAnimationFrameRef.current);
      }
      if (remotePoseRef.current) {
        remotePoseRef.current.close();
      }
    };
  }, [showSkeleton, remoteStream, initializeRemotePose]);

  // Check socket connection and join room
  useEffect(() => {
    if (!socket || !currentUser) return;

    const onConnect = () => {
      console.log("Socket connected");
      setIsConnected(true);
      setConnectionError(null);
      
      console.log("Joining room with user:", currentUser, "roomId:", id);
      
      socket.emit("join-room", { 
        emailId: currentUser, 
        roomId: id
      });
    };

    const onDisconnect = () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    };

    const onConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      setConnectionError("Failed to connect to signaling server");
    };

    const onJoinedRoom = ({ roomId }: { roomId: string }) => {
      console.log(`Successfully joined room: ${roomId}`);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("joined-room", onJoinedRoom);

    if (socket.connected) {
      setIsConnected(true);
      socket.emit("join-room", { 
        emailId: currentUser, 
        roomId: id 
      });
    }

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("joined-room", onJoinedRoom);
    };
  }, [socket, id, currentUser]);

  // Handle new user joined
  const handleNewUserJoined = useCallback(async ({ emailId }: { emailId: string }) => {
    try {
      console.log("New User Joined Room:", emailId);
      
      if (peer.connectionState === 'closed' || peer.connectionState === 'failed') {
        console.error("Peer connection is not available");
        return;
      }
      
      setRemoteEmailId(emailId);
      
      setTimeout(async () => {
        try {
          const offer = await createOffer();
          console.log("Created offer, sending to:", emailId);
          socket.emit("call-user", { emailId, offer });
        } catch (error) {
          console.error("Error creating offer:", error);
        }
      }, 500);
    } catch (error) {
      console.error("Error handling user joined:", error);
    }
  }, [createOffer, socket, peer]);

  // Handle incoming call
  const handleIncomingCall = useCallback(async ({ from, offer }: { from: string, offer: RTCSessionDescriptionInit }) => {
    try {
      console.log("Incoming call from:", from);
      setRemoteEmailId(from);
      const ans = await createAnswers(offer);
      console.log("Created answer, sending to:", from);
      socket.emit("call-accepted", { emailId: from, ans });
    } catch (error) {
      console.error("Error handling incoming call:", error);
    }
  }, [createAnswers, socket]);

  // Handle call accepted
  const handleCallAccepted = useCallback(async ({ ans }: { ans: RTCSessionDescriptionInit }) => {
    try {
      console.log("Call accepted, setting remote answer");
      await setRemoteAns(ans);
      
      if (myStream) {
        console.log("Sending stream after call accepted");
        sendStream(myStream);
      }
    } catch (error) {
      console.error("Error handling call accepted:", error);
    }
  }, [setRemoteAns, myStream, sendStream]);

  // Socket event handlers
  useEffect(() => {
    if (!isConnected) return;

    socket.on("user-joined", handleNewUserJoined);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-accepted", handleCallAccepted);

    return () => {
      socket.off("user-joined", handleNewUserJoined);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("call-accepted", handleCallAccepted);
    };
  }, [socket, handleNewUserJoined, handleIncomingCall, handleCallAccepted, isConnected]);

  // Handle negotiation needed
  const handleNegotiation = useCallback(async () => {
    if (!peer || !remoteEmailId || !isConnected) return;

    try {
      console.log("Negotiation needed");
      
      if (peer.connectionState === 'closed' || peer.connectionState === 'failed') {
        console.error("Peer connection is not available for negotiation");
        return;
      }

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      socket.emit("call-user", {
        emailId: remoteEmailId,
        offer
      });
    } catch (error) {
      console.error("Negotiation error:", error);
    }
  }, [peer, remoteEmailId, socket, isConnected]);

  useEffect(() => {
    if (!peer) return;

    peer.addEventListener("negotiationneeded", handleNegotiation);

    return () => {
      peer.removeEventListener("negotiationneeded", handleNegotiation);
    };
  }, [peer, handleNegotiation]);

  // Get media stream
  const getUserMediaStream = useCallback(async () => {
    try {
      console.log("Getting user media stream");
      
      if (peer.connectionState === 'closed' || peer.connectionState === 'failed') {
        console.error("Peer connection is not available");
        setConnectionError("Peer connection failed");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      console.log("Got local stream:", stream);
      setMyStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing media devices:", error);
      setConnectionError("Failed to access camera/microphone");
    }
  }, [peer]);

  // Send stream when remoteEmailId is set
  useEffect(() => {
    if (myStream && remoteEmailId) {
      console.log("Sending stream to remote peer");
      sendStream(myStream);
    }
  }, [myStream, remoteEmailId, sendStream]);

  // Call getUserMediaStream on mount
  useEffect(() => {
    getUserMediaStream();
  }, [getUserMediaStream]);

  // Set remote stream
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log("Setting remote stream:", remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play()
        .then(() => console.log("Remote video playing"))
        .catch(e => console.error("Error playing remote video:", e));
    }
  }, [remoteStream]);

  // ICE candidate handling
  useEffect(() => {
    if (!peer || !remoteEmailId || !isConnected) return;

    const handleIceCandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event.candidate) {
        console.log("Sending ICE candidate");
        socket.emit("ice-candidate", {
          candidate: event.candidate,
          to: remoteEmailId
        });
      }
    };

    peer.addEventListener("icecandidate", handleIceCandidate);

    return () => {
      peer.removeEventListener("icecandidate", handleIceCandidate);
    };
  }, [peer, socket, remoteEmailId, isConnected]);

  // Receive ICE candidates
  useEffect(() => {
    if (!isConnected) return;

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      try {
        if (peer.connectionState !== 'closed') {
          console.log("Received ICE candidate");
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error("Error adding ICE candidate:", err);
      }
    };

    socket.on("ice-candidate", handleIceCandidate);

    return () => {
      socket.off("ice-candidate", handleIceCandidate);
    };
  }, [peer, socket, isConnected]);

  // Monitor peer connection state
  useEffect(() => {
    if (!peer) return;

    const handleConnectionStateChange = () => {
      console.log("Peer connection state:", peer.connectionState);
      if (peer.connectionState === 'connected') {
        console.log("Successfully connected to peer!");
      } else if (peer.connectionState === 'failed' || peer.connectionState === 'closed') {
        setConnectionError("Connection lost");
      }
    };

    const handleIceConnectionStateChange = () => {
      console.log("ICE connection state:", peer.iceConnectionState);
    };

    peer.addEventListener("connectionstatechange", handleConnectionStateChange);
    peer.addEventListener("iceconnectionstatechange", handleIceConnectionStateChange);

    return () => {
      peer.removeEventListener("connectionstatechange", handleConnectionStateChange);
      peer.removeEventListener("iceconnectionstatechange", handleIceConnectionStateChange);
    };
  }, [peer]);

  const handleEndSession = () => {
    if (remoteAnimationFrameRef.current) {
      cancelAnimationFrame(remoteAnimationFrameRef.current);
    }
    if (remotePoseRef.current) {
      remotePoseRef.current.close();
    }
    
    if (myStream) {
      myStream.getTracks().forEach(track => track.stop());
    }
    
    if (peer && peer.connectionState !== 'closed') {
      peer.close();
    }

    if (socket) {
      socket.disconnect();
    }

    navigate(-1);
  };

  const toggleMute = () => {
    if (!myStream) return;

    myStream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setIsMuted(!isMuted);
  };

  const toggleVideo = () => {
    if (!myStream) return;

    myStream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });

    setIsVideoOff(!isVideoOff);
  };

  if (connectionError) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="bg-white p-8 rounded-2xl text-center max-w-md">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
          <p className="text-slate-600 mb-6">{connectionError}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col md:flex-row overflow-hidden font-sans text-slate-100">
      
      {/* Connection Status Indicators */}
      {!isConnected && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500 text-black px-4 py-2 rounded-full text-sm font-bold">
          Connecting to server...
        </div>
      )}
      
      {peer.connectionState === 'connected' && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold">
          Connected to peer
        </div>
      )}
      
      {remoteEmailId && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-50 bg-blue-500 text-white px-4 py-2 rounded-full text-sm font-bold">
          Connected to: {remoteEmailId}
        </div>
      )}
      
      {/* Chat Toggle Button for Mobile */}
      <button
        onClick={() => setShowChat(!showChat)}
        className="md:hidden fixed bottom-24 right-4 z-50 bg-indigo-600 text-white p-4 rounded-full shadow-lg"
      >
        <MessageSquare size={24} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
      
      {/* ─── LEFT: VIDEO STREAM AREA ─── */}
      <div className="flex-1 relative flex flex-col bg-black">
        {/* Main Video (Remote User) with Skeleton */}
        <div className="flex-1 flex items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10 pointer-events-none" />
          
          {/* Remote Video with Skeleton Overlay */}
          <div className="w-full h-full bg-slate-900 flex items-center justify-center text-slate-500 relative">
            {!remoteStream ? (
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                  <VideoOff size={40} />
                </div>
                <p className="font-bold uppercase tracking-widest text-xs">Waiting for other user...</p>
                {remoteEmailId && <p className="text-sm text-green-400 mt-2">{remoteEmailId} joined</p>}
              </div>
            ) : (
              <>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                    showSkeleton ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <canvas
                  ref={remoteCanvasRef}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
                    showSkeleton ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  width="640"
                  height="480"
                />
              </>
            )}
          </div>

          {/* Local Video Preview - No skeleton */}
          <div className="absolute top-6 right-6 w-64 h-48 bg-slate-800 rounded-2xl border-2 border-white/20 shadow-2xl overflow-hidden z-20">
            {myStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-white">
                Loading camera...
              </div>
            )}
            
            {/* Skeleton Toggle Button for Remote Only */}
            <button
              onClick={toggleSkeleton}
              className="absolute bottom-2 left-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 z-30"
            >
              <Activity size={12} />
              {showSkeleton ? 'Hide' : 'Show'} Remote Skeleton
            </button>
          </div>

          {/* User Name Tag */}
          <div className="absolute bottom-24 left-6 z-20">
            <h2 className="text-lg font-bold">
              {remoteEmailId ? remoteEmailId : 'Waiting for other user'}
            </h2>
            <p className="text-xs text-teal-400 flex items-center gap-1">
              <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" /> Live Session
            </p>
          </div>
        </div>

        {/* Data Channel Status */}
        <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
          {dataChannelReady ? (
            <div className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <Wifi size={12} />
              <span>Chat Ready</span>
            </div>
          ) : (
            <div className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs flex items-center gap-1">
              <WifiOff size={12} />
              <span>Connecting Chat...</span>
            </div>
          )}
        </div>

        {/* Media Control Bar */}
        <div className="h-20 bg-slate-900/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center gap-4 px-6 z-30">
          <button 
            onClick={toggleMute}
            className={`p-4 rounded-2xl transition-all ${isMuted ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          
          <button 
            onClick={toggleVideo}
            className={`p-4 rounded-2xl transition-all ${isVideoOff ? 'bg-rose-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          <button 
            onClick={toggleSkeleton}
            className={`p-4 rounded-2xl transition-all ${showSkeleton ? 'bg-green-500 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <Activity size={20} />
          </button>

          <button 
            onClick={handleEndSession}
            className="p-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl transition-all px-8 flex items-center gap-2 font-bold"
          >
            <PhoneOff size={20} /> <span className="hidden md:inline">End Session</span>
          </button>

          {/* Chat Toggle Button for Mobile */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="md:hidden p-4 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 relative"
          >
            <MessageSquare size={20} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-4 h-4 rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ─── RIGHT: CHAT SIDEBAR WITH JOINT ANGLES ─── */}
      <div className={`
        w-full md:w-[380px] bg-white flex flex-col h-full shadow-2xl z-40
        transition-transform duration-300 ease-in-out
        ${showChat ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        fixed md:relative top-0 right-0
      `}>
        {/* Chat Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <MessageSquare size={20} />
            </div>
            <div>
              <h3 className="font-black text-slate-900">In-Call Messages</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                {dataChannelReady ? (
                  <>
                    <CheckCheck size={12} className="text-green-500" />
                    <span>Connected</span>
                  </>
                ) : (
                  <>
                    <WifiOff size={12} className="text-yellow-500" />
                    <span>Connecting...</span>
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowAngles(!showAngles)}
              className={`p-2 rounded-lg transition-all ${showAngles ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <Activity size={18} />
            </button>
            <button 
              onClick={() => setShowChat(false)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Joint Angles Panel */}
        {showAngles && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100">
            <h4 className="font-bold text-indigo-800 mb-3 flex items-center gap-2">
              <Activity size={16} />
              Remote Patient Joint Angles
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Right Elbow</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.rightElbow}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Left Elbow</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.leftElbow}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Right Knee</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.rightKnee}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Left Knee</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.leftKnee}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Right Shoulder</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.rightShoulder}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Left Shoulder</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.leftShoulder}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Right Hip</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.rightHip}°</p>
              </div>
              <div className="bg-white p-2 rounded-lg">
                <p className="text-xs text-slate-500">Left Hip</p>
                <p className="text-lg font-bold text-indigo-600">{jointAngles.leftHip}°</p>
              </div>
            </div>
          </div>
        )}

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
          {peerMessages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.sender === 'Me' ? 'items-end' : 'items-start'}`}>
              {msg.type === 'system' ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 italic">
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                  <span>{msg.text}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-slate-500">
                      {msg.sender}
                    </span>
                  </div>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-sm relative group ${
                    msg.sender === 'Me' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                  }`}>
                    {msg.text}
                    
                    {/* Message Status for sent messages */}
                    {msg.sender === 'Me' && (
                      <span className="absolute -bottom-4 right-0 text-[8px] text-slate-400 flex items-center gap-0.5">
                        {msg.status === 'sending' && <Check size={10} />}
                        {msg.status === 'sent' && <Check size={10} />}
                        {msg.status === 'delivered' && <CheckCheck size={10} />}
                        {msg.status === 'read' && <CheckCheck size={10} className="text-blue-500" />}
                      </span>
                    )}
                  </div>
                  <span className="text-[8px] text-slate-400 mt-1 px-1">
                    {msg.time}
                  </span>
                </>
              )}
            </div>
          ))}
          
          {/* Typing Indicator */}
          {typingStatus.isTyping && (
            <div className="flex items-start">
              <div className="bg-white text-slate-700 p-3 rounded-2xl rounded-tl-none shadow-sm border border-slate-100">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100 focus-within:border-indigo-500 transition-all">
            <input 
              ref={chatInputRef}
              type="text" 
              placeholder={dataChannelReady ? "Type your message..." : "Connecting chat..."}
              className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 px-2"
              value={chatInput}
              onChange={handleChatInputChange}
              disabled={!dataChannelReady}
            />
            <button 
              type="submit"
              disabled={!dataChannelReady || !chatInput.trim()}
              className={`p-2.5 rounded-xl transition shadow-lg ${
                dataChannelReady && chatInput.trim()
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-100'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Send size={16} />
            </button>
          </div>
          <p className="text-center text-[9px] text-slate-400 mt-3 font-medium uppercase tracking-widest">
            {dataChannelReady 
              ? 'Messages are encrypted and sent via WebRTC'
              : 'Establishing secure chat connection...'
            }
          </p>
        </form>
      </div>
    </div>
  );
};

export default SessionPage;