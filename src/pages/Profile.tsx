import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { Globe, Github } from 'lucide-react'
import { useShipLog } from '../lib/store'
import { levelForXP } from '../lib/types'
import { ACHIEVEMENTS } from '../lib/achievements'
import { Orbs, CategoryPill, Logo, stagger } from '../components/ui'
import { Markdownish } from '../components/Markdownish'

export function PublicProfile() {
  const { profile, events, unlocked } = useShipLog()
  const { username } = useParams()
  const level = levelForXP(profile.builderScore)
  const recent = [...events].sort((a, b) => b.eventTime.localeCompare(a.eventTime)).slice(0, 10)
  const badges = ACHIEVEMENTS.filter(a => unlocked[a.code])

  return (
    <PublicFrame>
      <motion.div initial="initial" animate="animate" variants={stagger} className="text-center">
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }}
          className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent/20 text-3xl font-bold text-accent">
          {profile.displayName[0]}
        </motion.div>
        <motion.h1 variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }} className="mt-4 text-2xl font-bold tracking-tight">
          {profile.displayName}
        </motion.h1>
        <motion.p variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }} className="mx-auto mt-1.5 max-w-sm text-sm text-secondary">
          {profile.bio}
        </motion.p>
        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }} className="mt-3 flex items-center justify-center gap-4 text-xs text-muted">
          {profile.website && <a href={profile.website} className="flex items-center gap-1 hover:text-accent"><Globe size={11} /> Website</a>}
          {profile.twitter && <a href={`https://x.com/${profile.twitter}`} className="hover:text-accent">𝕏 @{profile.twitter}</a>}
          {profile.github && <a href={`https://github.com/${profile.github}`} className="flex items-center gap-1 hover:text-accent"><Github size={11} /> GitHub</a>}
        </motion.div>

        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }} className="glass mx-auto mt-6 max-w-sm p-4">
          <div className="text-xs text-muted">Building</div>
          <div className="mt-0.5 font-semibold text-primary">{profile.projectName}</div>
          <div className="text-xs text-secondary">{profile.projectTagline}</div>
        </motion.div>

        <motion.div variants={{ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } }} className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 font-mono text-[13px] text-secondary">
          <span>🔥 {profile.streakCurrent} day streak</span>
          <span>📦 {profile.totalShips.toLocaleString()} things shipped</span>
          <span>⭐ Level {level.level}</span>
        </motion.div>
      </motion.div>

      <div className="mt-10">
        <SectionDivider>Recent Ships</SectionDivider>
        <div className="mt-4 space-y-2">
          {recent.map((e, i) => (
            <motion.div
              key={e.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="glass flex items-center gap-2.5 p-3.5"
            >
              <CategoryPill category={e.category} />
              <span className="min-w-0 flex-1 truncate text-[13px] text-primary">{e.title}</span>
              <span className="font-mono text-[10px] text-muted">{e.eventDate}</span>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <SectionDivider>Achievements</SectionDivider>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {badges.map(b => (
            <span key={b.code} title={`${b.name} — ${b.description}`} className="glass flex h-11 w-11 items-center justify-center !rounded-xl text-xl">
              {b.icon}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center">
        <Link to={`/${username}/changelog`} className="text-sm font-medium text-accent hover:underline">View full changelog →</Link>
      </div>
    </PublicFrame>
  )
}

export function PublicChangelog() {
  const { changelog, profile } = useShipLog()
  const { username } = useParams()

  return (
    <PublicFrame>
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight">{profile.projectName} Changelog</h1>
        <p className="mt-1 text-sm text-secondary">by <Link to={`/${username}`} className="text-accent hover:underline">@{profile.username}</Link></p>
      </div>
      <div className="mt-8 space-y-4">
        {changelog.map((entry, i) => (
          <motion.article
            key={entry.id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.4 }}
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
      </div>
    </PublicFrame>
  )
}

function PublicFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-base">
      <Orbs />
      <div className="relative z-10 mx-auto max-w-2xl px-5 py-12">
        {children}
        <footer className="mt-16 flex items-center justify-center gap-2 border-t border-line pt-6 text-xs text-muted">
          <Logo size={16} /> Powered by Nalto · <Link to="/" className="text-accent hover:underline">Get your own ShipLog</Link>
        </footer>
      </div>
    </div>
  )
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-line" />
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted">{children}</span>
      <div className="h-px flex-1 bg-line" />
    </div>
  )
}
