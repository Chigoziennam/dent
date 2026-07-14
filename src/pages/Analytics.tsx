import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { format, subDays, startOfWeek, parseISO } from 'date-fns'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useShipLog } from '../lib/store'
import { levelForXP } from '../lib/types'
import { Page, GlassCard, CountUp, XPBar, SectionTitle, stagger } from '../components/ui'

export default function Analytics() {
  const { events, dailyLogs, profile, content } = useShipLog()
  const level = levelForXP(profile.builderScore)

  // Heatmap: last 26 weeks (mobile-friendly), Mon-start columns
  const heatmap = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of events) counts.set(e.eventDate, (counts.get(e.eventDate) ?? 0) + 1)
    const weeks: { date: string; count: number }[][] = []
    const start = startOfWeek(subDays(new Date(), 26 * 7), { weekStartsOn: 1 })
    for (let w = 0; w < 27; w++) {
      const col: { date: string; count: number }[] = []
      for (let d = 0; d < 7; d++) {
        const date = format(new Date(start.getTime() + (w * 7 + d) * 86400000), 'yyyy-MM-dd')
        col.push({ date, count: counts.get(date) ?? 0 })
      }
      weeks.push(col)
    }
    return weeks
  }, [events])

  // Weekly velocity for area chart
  const velocity = useMemo(() => {
    const byWeek = new Map<string, number>()
    for (const e of events) {
      const wk = format(startOfWeek(parseISO(e.eventDate), { weekStartsOn: 1 }), 'MMM d')
      byWeek.set(wk, (byWeek.get(wk) ?? 0) + 1)
    }
    return [...byWeek.entries()].map(([week, count]) => ({ week, count }))
  }, [events])

  const activeDays = new Set(events.map(e => e.eventDate)).size
  const stats = [
    { label: 'Total Events', value: events.length },
    { label: 'Active Days', value: activeDays },
    { label: 'Avg / Day', value: Math.round((events.length / Math.max(activeDays, 1)) * 10) / 10 },
    { label: 'Longest Streak', value: profile.streakLongest },
    { label: 'Content Created', value: content.length },
    { label: 'Daily Logs', value: dailyLogs.length },
  ]

  const cellColor = (c: number) =>
    c === 0 ? 'rgba(255,255,255,0.04)'
    : c <= 2 ? 'rgba(99,102,241,0.25)'
    : c <= 5 ? 'rgba(99,102,241,0.55)'
    : '#6366f1'

  return (
    <Page>
      <motion.div initial="initial" animate="animate" variants={stagger} className="space-y-4">
        {/* Builder score hero */}
        <GlassCard>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionTitle>Builder Score</SectionTitle>
              <CountUp value={profile.builderScore} className="text-4xl font-bold text-primary" suffix=" XP" />
              <div className="text-gradient mt-1 text-sm font-semibold">Level {level.level} — “{level.name}”</div>
            </div>
            <div className="w-full sm:w-64"><XPBar into={level.into} needed={level.needed} level={level.level} /></div>
          </div>
        </GlassCard>

        {/* Heatmap */}
        <GlassCard>
          <SectionTitle>Shipping Heatmap · last 6 months</SectionTitle>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-[3px]" style={{ minWidth: 27 * 15 }}>
              {heatmap.map((col, w) => (
                <div key={w} className="flex flex-col gap-[3px]">
                  {col.map((cell, d) => (
                    <motion.div
                      key={cell.date}
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (w * 7 + d) * 0.004, duration: 0.2 }}
                      title={`${format(parseISO(cell.date), 'MMM d')}: ${cell.count} events`}
                      className="h-3 w-3 rounded-[3px]"
                      style={{ background: cellColor(cell.count) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 font-mono text-[10px] text-muted">
            Less
            {[0, 2, 5, 7].map(c => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: cellColor(c) }} />)}
            More
          </div>
        </GlassCard>

        {/* Velocity */}
        <GlassCard>
          <SectionTitle>Velocity · events per week</SectionTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={velocity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="velGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="week" tick={{ fill: '#555566', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fill: '#555566', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeDasharray: '3 3' }}
                  contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, fontSize: 12, color: '#f0f0f5' }}
                  labelStyle={{ color: '#8888a0' }}
                />
                <Area type="monotone" dataKey="count" name="Events" stroke="#6366f1" strokeWidth={2} fill="url(#velGrad)" animationDuration={1200} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Stat cards */}
        <motion.div variants={{ animate: { transition: { staggerChildren: 0.06 } } }} className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {stats.map(s => (
            <GlassCard key={s.label} className="!p-4 text-center">
              <CountUp value={s.value} className="text-2xl font-bold text-primary" />
              <div className="mt-0.5 text-xs text-secondary">{s.label}</div>
            </GlassCard>
          ))}
        </motion.div>
      </motion.div>
    </Page>
  )
}
