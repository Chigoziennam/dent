import { useEffect, useState } from 'react'

export function Typewriter({ text, className = '', speed = 8 }: { text: string; className?: string; speed?: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    setShown(0)
    const t = setInterval(() => {
      setShown(s => {
        if (s >= text.length) { clearInterval(t); return s }
        return s + 3
      })
    }, speed)
    return () => clearInterval(t)
  }, [text, speed])
  return (
    <div className={className}>
      {text.slice(0, shown)}
      {shown < text.length && <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-accent align-middle" />}
    </div>
  )
}
