import { useEffect, useRef, type ReactNode } from 'react'
import gsap from '../vendor/gsap/gsap.js'
import ScrollTrigger from '../vendor/gsap/ScrollTrigger.js'

gsap.registerPlugin(ScrollTrigger)

const FRAMES = 280
const POSTER = '/space/earth-seq-poster.jpg'
const frameSrc = (i: number) => `/space/seq/${String(i + 1).padStart(4, '0')}.webp`

export default function EarthSequence({ children }: { children?: ReactNode }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const track = trackRef.current
    const canvas = canvasRef.current
    const overlay = overlayRef.current
    if (!track || !canvas) return

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as any).connection?.saveData === true
    if (reduce || saveData) return

    const ctx = canvas.getContext('2d')!
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const images: (HTMLImageElement | null)[] = new Array(FRAMES).fill(null)
    let current = -1
    let requested = new Set<number>()

    const sizeCanvas = () => {
      canvas.width = Math.round(canvas.clientWidth * dpr)
      canvas.height = Math.round(canvas.clientHeight * dpr)
      draw(current < 0 ? 0 : current, true)
    }

    const draw = (i: number, force = false) => {
      const idx = Math.max(0, Math.min(FRAMES - 1, Math.round(i)))
      if (idx === current && !force) return
      current = idx
      const img = images[idx]
      if (!img || !img.complete || img.naturalWidth === 0) return
      const cw = canvas.width, ch = canvas.height
      const iw = img.naturalWidth, ih = img.naturalHeight
      const s = Math.max(cw / iw, ch / ih)
      const w = iw * s, h = ih * s
      ctx.clearRect(0, 0, cw, ch)
      ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h)
    }

    const loadFrame = (i: number) => {
      if (i < 0 || i >= FRAMES || requested.has(i)) return
      requested.add(i)
      const img = new Image()
      img.decoding = 'async'
      img.onload = () => {
        images[i] = img
        if (i === current) draw(i, true)
      }
      img.src = frameSrc(i)
    }

    // Preload around the current frame + first/last clusters
    const preloadAround = (idx: number) => {
      for (let d = 0; d <= 20; d++) {
        loadFrame(idx + d)
        loadFrame(idx - d)
      }
    }

    // Seed: load frame 0 immediately + last frame + spread of keyframes
    loadFrame(0)
    loadFrame(FRAMES - 1)
    for (let k = 0; k < FRAMES; k += 10) loadFrame(k)

    const state = { f: 0 }
    const st = gsap.to(state, {
      f: FRAMES - 1,
      ease: 'none',
      scrollTrigger: {
        trigger: track,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: () => {
          const idx = Math.round(state.f)
          draw(state.f)
          preloadAround(idx)
          if (overlay) {
            overlay.style.transform = `translateY(${-(idx / FRAMES) * 16}px)`
          }
        },
      },
    })

    window.addEventListener('resize', sizeCanvas)
    sizeCanvas()

    // Background: fill remaining frames after initial paint
    let bgIdx = 0
    const fillRemaining = () => {
      const batch = 8
      for (let j = 0; j < batch && bgIdx < FRAMES; bgIdx++) {
        if (!requested.has(bgIdx)) { loadFrame(bgIdx); j++ }
      }
      if (bgIdx < FRAMES) requestAnimationFrame(fillRemaining)
    }
    requestAnimationFrame(fillRemaining)

    return () => {
      window.removeEventListener('resize', sizeCanvas)
      st.scrollTrigger?.kill()
      st.kill()
    }
  }, [])

  return (
    <div ref={trackRef} className="relative h-[300vh]">
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-base">
        <img
          src={POSTER}
          alt="Earth seen from space"
          className="absolute inset-0 h-full w-full object-cover"
          {...{ fetchpriority: 'high' } as any}
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-base/40 via-base/20 to-base/70" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-base to-transparent" />
        <div
          ref={overlayRef}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center px-5 text-center"
        >
          {children}
        </div>
      </div>
    </div>
  )
}
