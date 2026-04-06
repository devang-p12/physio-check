import React, { useRef, useEffect, useState } from 'react'

type Target = { x: number; y: number; r: number; hit: boolean; id: number }

interface Props {
  /** total seconds for the round */
  duration?: number
  /** how many targets to spawn */
  targets?: number
  /** parent drives start via isActive */
  isActive: boolean
  /** fired once on round end */
  onComplete?: (score: { hits: number; total: number; accuracy: number }) => void
  /** live hits count for parent sidebar */
  onHitsChange?: (h: number) => void
  /** live time remaining for parent sidebar */
  onTimeChange?: (t: number) => void
}

function makeTargets(count: number): Target[] {
  return Array.from({ length: count }, (_, id) => ({
    id,
    x: 0.08 + Math.random() * 0.84,
    y: 0.12 + Math.random() * 0.76,
    r: 0.055 + Math.random() * 0.04,
    hit: false,
  }))
}

export default function ReactionExercise({
  duration = 30,
  targets = 10,
  isActive,
  onComplete,
  onHitsChange,
  onTimeChange,
}: Props) {
  const videoRef  = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // refs so RAF closure always has fresh values
  const targetsRef = useRef<Target[]>(makeTargets(targets))
  const hitsRef    = useRef(0)
  const runningRef = useRef(false)
  const cameraRef  = useRef<any>(null)
  const handsRef   = useRef<any>(null)
  const rafRef     = useRef(0)

  const [targetsState, setTargetsState] = useState<Target[]>(targetsRef.current)
  const [hits,     setHits]     = useState(0)
  const [timeLeft, setTimeLeft] = useState(duration)
  const [started,  setStarted]  = useState(false)
  const [done,     setDone]     = useState(false)
  const [loading,  setLoading]  = useState(false)

  // start / stop driven by isActive prop
  useEffect(() => {
    if (isActive && !runningRef.current) startRound()
    if (!isActive && runningRef.current) stopRound()
  }, [isActive])

  useEffect(() => () => stopRound(), [])

  function resetState() {
    const fresh = makeTargets(targets)
    targetsRef.current = fresh
    hitsRef.current = 0
    setTargetsState(fresh)
    setHits(0)
    setDone(false)
    setTimeLeft(duration)
    onHitsChange?.(0)
    onTimeChange?.(duration)
  }

  async function startRound() {
    resetState()
    setLoading(true)
    runningRef.current = true
    setStarted(true)

    // @ts-ignore
    const { Hands }  = await import('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js')
    // @ts-ignore
    const { Camera } = await import('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js')

    const hands = new Hands({ locateFile: (f: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}` })
    handsRef.current = hands

    hands.setOptions({ maxNumHands: 1, modelComplexity: 0, minDetectionConfidence: 0.55, minTrackingConfidence: 0.55 })

    const endAt = Date.now() + duration * 1000

    hands.onResults((results: any) => {
      if (!runningRef.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')!

      const rect = canvas.getBoundingClientRect()
      canvas.width  = rect.width
      canvas.height = rect.height
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const W = canvas.width, H = canvas.height

      // Draw targets (x-mirrored to match mirrored video)
      targetsRef.current.forEach(t => {
        const cx = (1 - t.x) * W
        const cy = t.y * H
        const r  = t.r * W
        if (!t.hit) {
          const g = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.3)
          g.addColorStop(0, 'rgba(59,130,246,0.9)')
          g.addColorStop(1, 'rgba(59,130,246,0)')
          ctx.beginPath(); ctx.arc(cx, cy, r * 1.3, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill()
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(59,130,246,0.85)'; ctx.fill()
          ctx.strokeStyle = '#B08070'; ctx.lineWidth = 3; ctx.stroke()
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.font = `bold ${Math.round(r * 1.2)}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText('+', cx, cy)
        } else {
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(34,197,94,0.25)'; ctx.fill()
        }
      })

      // Draw fingertip + hit detection
      if (results.multiHandLandmarks?.[0]) {
        const tip = results.multiHandLandmarks[0][8]
        const fx = (1 - tip.x) * W   // mirror x
        const fy = tip.y * H
        ctx.beginPath(); ctx.arc(fx, fy, 18, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.stroke()
        ctx.beginPath(); ctx.arc(fx, fy, 8, 0, Math.PI * 2)
        ctx.fillStyle = 'white'; ctx.fill()

        let changed = false
        const updated = targetsRef.current.map(t => {
          if (t.hit) return t
          const cx = (1 - t.x) * W, cy = t.y * H
          if (Math.hypot(cx - fx, cy - fy) < t.r * W + 16) {
            hitsRef.current += 1; changed = true; return { ...t, hit: true }
          }
          return t
        })
        if (changed) {
          targetsRef.current = updated
          setTargetsState([...updated])
          setHits(hitsRef.current)
          onHitsChange?.(hitsRef.current)
        }
      }
    })

    const camera = new Camera(videoRef.current!, {
      onFrame: async () => { if (handsRef.current) await handsRef.current.send({ image: videoRef.current }) },
      width: 1280, height: 720,
    })
    cameraRef.current = camera
    await camera.start()
    setLoading(false)

    const tick = () => {
      if (!runningRef.current) return
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000))
      setTimeLeft(left)
      onTimeChange?.(left)
      if (Date.now() >= endAt || targetsRef.current.every(t => t.hit)) { finish(); return }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function finish() {
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
    cameraRef.current?.stop(); handsRef.current?.close()
    cameraRef.current = null; handsRef.current = null
    setTimeLeft(0); setDone(true)
    onComplete?.({ hits: hitsRef.current, total: targets, accuracy: Math.round((hitsRef.current / targets) * 100) })
  }

  function stopRound() {
    if (!runningRef.current) return
    runningRef.current = false
    cancelAnimationFrame(rafRef.current)
    cameraRef.current?.stop(); handsRef.current?.close()
    cameraRef.current = null; handsRef.current = null
  }

  return (
    <div className="absolute inset-0 w-full h-full bg-black">
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" autoPlay muted playsInline />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full z-10" />

      {/* loading */}
      {loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/60">
          <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
          <p className="text-white font-semibold">Loading hand tracking…</p>
        </div>
      )}

      {/* waiting to start */}
      {!started && !loading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/50">
          <div className="text-center px-8">
            <div className="text-6xl mb-4">👆</div>
            <h2 className="text-2xl font-bold text-white mb-2">Reaction Exercise</h2>
            <p className="text-white/80 text-sm mb-1">{targets} targets · {duration}s</p>
            <p className="text-white/60 text-sm mt-2">Press <span className="text-teal-400 font-bold">Start Session</span> on the right to begin.<br/>Point your index finger at the blue circles!</p>
          </div>
        </div>
      )}

      {/* done overlay */}
      {done && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70">
          <div className="text-center px-8">
            <div className="text-6xl mb-4">🎯</div>
            <h2 className="text-2xl font-bold text-white mb-2">Round Complete!</h2>
            <p className="text-white/80 text-lg">{hitsRef.current} / {targets} targets hit</p>
            <p className="text-teal-400 font-bold text-3xl mt-2">{Math.round((hitsRef.current / targets) * 100)}% accuracy</p>
            <p className="text-white/50 text-sm mt-4">Press <span className="text-white font-semibold">Finish</span> on the right to save.</p>
          </div>
        </div>
      )}

      {/* timer badge */}
      {started && !done && !loading && (
        <div className="absolute top-5 right-5 z-20 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-2 text-white font-mono font-bold text-lg">
          {timeLeft}s
        </div>
      )}
    </div>
  )
}
