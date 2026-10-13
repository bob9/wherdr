import type { ThemeColors, ThemeDef } from './themes'
import { DEFAULT_THEME, themeById } from './themes'

// Themes made on the device (Settings › Appearance › Theme › Customize): a
// built-in theme as the base, plus the colors the person changed and the two
// "quiet" switches (side bars, tinted backgrounds). Kept in localStorage,
// shared as a short JSON code (Copy code / Import).

export const CUSTOM_PREFIX = 'custom-'
export const CUSTOM_KEY = 'customThemes'
const MAX_THEMES = 30
const MAX_LABEL = 40
const HEX = /^#[0-9a-f]{6}$/i

export interface CustomTheme {
  id: string
  label: string
  base: string
  c: Partial<ThemeColors>
  bars?: boolean
  tints?: boolean
}

// Colors offered in the editor, by group, in the order they are shown.
export type EditableColor = Exclude<keyof ThemeColors, 'onAccent' | 'surface2' | 'inputLine' | 'selection' | 'ring' | 'lav' | 'coral'>
export const EDITOR_GROUPS: { title: string, keys: { key: EditableColor, label: string }[] }[] = [
  { title: 'Base', keys: [
    { key: 'bg', label: 'Background' }, { key: 'bg2', label: 'Sidebar and windows' }, { key: 'surface', label: 'Cards' },
    { key: 'line', label: 'Lines' }, { key: 'text', label: 'Text' }, { key: 'muted', label: 'Secondary text' }, { key: 'dim', label: 'Faint text' },
  ] },
  { title: 'Highlights', keys: [
    { key: 'accent', label: 'Accent' }, { key: 'heading', label: 'Section titles' }, { key: 'attention', label: 'Waiting for you' },
    { key: 'logo', label: 'Agent logos' }, { key: 'meter', label: 'Quota bars' },
  ] },
  { title: 'States', keys: [
    { key: 'working', label: 'Working' }, { key: 'blocked', label: 'Your turn' }, { key: 'done', label: 'Ready' },
  ] },
  { title: 'Palette', keys: [
    { key: 'green', label: 'Green' }, { key: 'ochre', label: 'Yellow' }, { key: 'rose', label: 'Red' }, { key: 'blue', label: 'Blue' }, { key: 'teal', label: 'Cyan' },
  ] },
]
const EDITABLE = new Set<string>(EDITOR_GROUPS.flatMap(g => g.keys.map(k => k.key)))

// Brand colors of the agent logos, the default of `logo` (see themeVars).
const LOGO_DEFAULT = '#d77757'

// The color a theme actually shows for a key, its own or the one derived from the palette
// (same fallbacks as themeVars), so the editor always has a value to start from.
export function effectiveColor(th: ThemeDef, key: EditableColor): string {
  const c = th.c
  switch (key) {
    case 'heading': return c.heading || c.accent
    case 'attention': return c.attention || c.rose
    case 'meter': return c.meter || c.teal
    case 'logo': return c.logo || LOGO_DEFAULT
    case 'working': return c.working || c.blue
    case 'blocked': return c.blocked || c.rose
    case 'done': return c.done || c.teal
    default: return c[key] as string
  }
}

// Full theme: the base with the person's colors on top.
export function customThemeDef(ct: CustomTheme): ThemeDef {
  const base = themeById(ct.base) || themeById(DEFAULT_THEME)!
  return {
    ...base,
    id: ct.id,
    label: ct.label,
    base: base.id,
    bars: ct.bars ?? base.bars,
    tints: ct.tints ?? base.tints,
    c: { ...base.c, ...ct.c },
  }
}

// One theme read from storage or a pasted code: unknown keys and anything that
// is not a #rrggbb color are dropped, so nothing else can reach the stylesheet.
export function sanitizeCustomTheme(v: unknown): CustomTheme | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const base = typeof o.base === 'string' && themeById(o.base) ? o.base : null
  if (!base) return null
  const c: Partial<ThemeColors> = {}
  if (o.c && typeof o.c === 'object') {
    for (const [k, val] of Object.entries(o.c as Record<string, unknown>))
      if (EDITABLE.has(k) && typeof val === 'string' && HEX.test(val)) (c as Record<string, string>)[k] = val.toLowerCase()
  }
  const label = typeof o.label === 'string' ? o.label.replace(/\s+/g, ' ').trim().slice(0, MAX_LABEL) : ''
  const id = typeof o.id === 'string' && /^custom-[a-z0-9-]{1,40}$/.test(o.id) ? o.id : ''
  return {
    id, label: label || 'My theme', base, c,
    ...(typeof o.bars === 'boolean' ? { bars: o.bars } : {}),
    ...(typeof o.tints === 'boolean' ? { tints: o.tints } : {}),
  }
}

export function parseCustomThemes(raw: string | null | undefined): CustomTheme[] {
  let list: unknown
  try { list = JSON.parse(raw || '[]') }
  catch { return [] }
  if (!Array.isArray(list)) return []
  const out: CustomTheme[] = []
  for (const v of list.slice(0, MAX_THEMES)) {
    const ct = sanitizeCustomTheme(v)
    if (ct && ct.id && !out.some(o => o.id === ct.id)) out.push(ct)
  }
  return out
}

export function newCustomId(taken: string[], rnd: () => number = Math.random): string {
  for (;;) {
    const id = `${CUSTOM_PREFIX}${Math.floor(rnd() * 36 ** 6).toString(36).padStart(6, '0')}`
    if (!taken.includes(id)) return id
  }
}

// A new theme starting from `from` (built-in or custom): same look, the person's to change.
export function copyTheme(from: ThemeDef, taken: string[], label: string): CustomTheme {
  const fromCustom = from.id.startsWith(CUSTOM_PREFIX)
  const base = fromCustom ? from.base || DEFAULT_THEME : from.id
  const baseDef = themeById(base)!
  const c: Partial<ThemeColors> = {}
  if (fromCustom) {
    for (const k of EDITABLE) {
      const v = from.c[k as EditableColor]
      if (v && v !== baseDef.c[k as EditableColor]) (c as Record<string, string>)[k] = v
    }
  }
  return {
    id: newCustomId(taken), label, base, c,
    ...(fromCustom && from.bars !== baseDef.bars ? { bars: from.bars } : {}),
    ...(fromCustom && from.tints !== baseDef.tints ? { tints: from.tints } : {}),
  }
}

// Shareable code: the theme without its device id.
export function exportCustomTheme(ct: CustomTheme): string {
  const { id: _id, ...rest } = ct
  return JSON.stringify({ wherdrTheme: 1, ...rest })
}

export function importCustomTheme(text: string, taken: string[]): CustomTheme | null {
  let v: unknown
  try { v = JSON.parse(text.trim()) }
  catch { return null }
  const ct = sanitizeCustomTheme(v)
  return ct ? { ...ct, id: newCustomId(taken) } : null
}
