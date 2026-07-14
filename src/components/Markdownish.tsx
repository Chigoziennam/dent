// Tiny renderer for the markdown subset our AI/changelog produces:
// headings, bullets, **bold**, *italic*. Avoids a full markdown dependency.
export function Markdownish({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n')
  return (
    <div className={className}>
      {lines.map((line, i) => {
        if (line.startsWith('### ')) return <h4 key={i} className="pt-1 text-sm font-semibold text-primary">{inline(line.slice(4))}</h4>
        if (line.startsWith('## ')) return <h3 key={i} className="pt-1 text-base font-semibold text-primary">{inline(line.slice(3))}</h3>
        if (line.startsWith('# ')) return <h2 key={i} className="pt-1 text-lg font-bold text-primary">{inline(line.slice(2))}</h2>
        if (line.startsWith('- ')) return <div key={i} className="flex gap-2"><span className="text-accent">•</span><span>{inline(line.slice(2))}</span></div>
        if (line.trim() === '') return <div key={i} className="h-2" />
        return <p key={i}>{inline(line)}</p>
      })}
    </div>
  )
}

function inline(s: string): React.ReactNode[] {
  const parts = s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-primary">{p.slice(2, -2)}</strong>
    if (p.startsWith('*') && p.endsWith('*')) return <em key={i}>{p.slice(1, -1)}</em>
    return <span key={i}>{p}</span>
  })
}
