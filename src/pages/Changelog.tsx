import { motion } from 'framer-motion'
import { ExternalLink } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useDent } from '../lib/store'
import { Page, stagger } from '../components/ui'
import { Markdownish } from '../components/Markdownish'

export default function Changelog() {
  const { changelog, profile } = useDent()

  return (
    <Page className="max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">Your public changelog — auto-generated from what you ship.</p>
        <Link to={`/${profile.username}/changelog`} className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          Public page <ExternalLink size={12} />
        </Link>
      </div>
      <motion.div initial="initial" animate="animate" variants={stagger} className="mt-6 space-y-4">
        {changelog.map(entry => (
          <motion.article
            key={entry.id}
            variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
            className="glass p-6"
          >
            <div className="flex items-center gap-3">
              {entry.versionTag && <span className="rounded-full bg-accent/15 px-2.5 py-0.5 font-mono text-xs font-semibold text-accent">{entry.versionTag}</span>}
              <span className="font-mono text-xs text-muted">{entry.publishedAt}</span>
            </div>
            <h2 className="mt-2.5 text-lg font-bold tracking-tight">{entry.title}</h2>
            <Markdownish text={entry.body} className="mt-2 space-y-1 text-sm leading-relaxed text-secondary" />
          </motion.article>
        ))}
      </motion.div>
    </Page>
  )
}
