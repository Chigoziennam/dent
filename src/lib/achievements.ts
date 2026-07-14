import type { AchievementDef } from './types'

export const ACHIEVEMENTS: AchievementDef[] = [
  // COMMON
  { code: 'first_ship', name: 'First Ship', description: 'Log your first event', icon: '🚢', xp: 25, rarity: 'common', threshold: 1, metric: 'total_events' },
  { code: 'hello_world', name: 'Hello World', description: 'Complete your first daily log', icon: '📝', xp: 25, rarity: 'common', threshold: 1, metric: 'daily_logs' },
  { code: 'social_butterfly', name: 'Social Butterfly', description: 'Generate your first post', icon: '🦋', xp: 25, rarity: 'common', threshold: 1, metric: 'content_pieces' },
  { code: 'week_one', name: 'Week One', description: 'Ship for 7 days total', icon: '🗓️', xp: 25, rarity: 'common', threshold: 7, metric: 'total_events' },
  // RARE
  { code: 'century_club', name: 'Century Club', description: 'Ship 100 events', icon: '💯', xp: 100, rarity: 'rare', threshold: 100, metric: 'total_events' },
  { code: 'consistent', name: 'Consistent', description: '7-day shipping streak', icon: '🔥', xp: 100, rarity: 'rare', threshold: 7, metric: 'streak_days' },
  { code: 'publisher', name: 'Publisher', description: 'Create 10 content pieces', icon: '📣', xp: 100, rarity: 'rare', threshold: 10, metric: 'content_pieces' },
  { code: 'committed', name: 'Committed', description: 'Log 50 commits', icon: '⌨️', xp: 100, rarity: 'rare', threshold: 50, metric: 'total_commits' },
  // EPIC
  { code: 'month_momentum', name: 'Month of Momentum', description: '30-day shipping streak', icon: '🌊', xp: 250, rarity: 'epic', threshold: 30, metric: 'streak_days' },
  { code: 'revenue_reporter', name: 'Revenue Reporter', description: 'Log 10 revenue or customer events', icon: '💸', xp: 250, rarity: 'epic', threshold: 10, metric: 'revenue_events' },
  { code: 'storyteller', name: 'Storyteller', description: 'Create 25 content pieces', icon: '📖', xp: 250, rarity: 'epic', threshold: 25, metric: 'content_pieces' },
  { code: 'reflective', name: 'Reflective', description: 'Complete 30 daily logs', icon: '🪞', xp: 250, rarity: 'epic', threshold: 30, metric: 'daily_logs' },
  // LEGENDARY
  { code: 'hundred_streak', name: '100 Day Streak', description: 'Ship every day for 100 days', icon: '☄️', xp: 500, rarity: 'legendary', threshold: 100, metric: 'streak_days' },
  { code: 'founder_mode', name: 'Founder Mode', description: 'Reach Level 15', icon: '👑', xp: 500, rarity: 'legendary', threshold: 15, metric: 'level' },
  { code: 'first_customer', name: 'First Customer', description: 'Log your first customer or revenue event', icon: '🤝', xp: 500, rarity: 'legendary', threshold: 1, metric: 'revenue_events' },
  { code: 'shipping_machine', name: 'Shipping Machine', description: 'Ship 500 events', icon: '🏭', xp: 500, rarity: 'legendary', threshold: 500, metric: 'total_events' },
]

export const RARITY_META = {
  common:    { label: 'Common',    color: '#8888a0', glow: 'rgba(136,136,160,0.2)' },
  rare:      { label: 'Rare',      color: '#60a5fa', glow: 'rgba(96,165,250,0.25)' },
  epic:      { label: 'Epic',      color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
  legendary: { label: 'Legendary', color: '#fcd34d', glow: 'rgba(252,211,77,0.3)' },
} as const
