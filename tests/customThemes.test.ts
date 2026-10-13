// Theme roles (attention, headings, quota bars, logos, side bars, tints),
// the Foxur theme and the themes made on the device.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { THEMES, storedThemeChoice, themeById, themeVars, themesCss } from '../app/utils/themes'
import { EDITOR_GROUPS, copyTheme, customThemeDef, effectiveColor, exportCustomTheme, importCustomTheme, newCustomId, parseCustomThemes, sanitizeCustomTheme } from '../app/utils/customThemes'

const titanium = themeById('wherdr-titanium')!
const foxur = themeById('foxur')!

describe('theme roles', () => {
  it('keep every existing theme as it was: roles fall back to the palette', () => {
    for (const th of THEMES.filter(t => t.id !== 'foxur')) {
      const v = themeVars(th)
      expect(v['--attention'], th.id).toBe('var(--rose)')
      expect(v['--heading'], th.id).toBe('var(--mauve)')
      expect(v['--meter'], th.id).toBe('var(--teal)')
      expect(v['--bar-w'], th.id).toBe('2px')
      expect(v['--attention-edge'], th.id).toBe('var(--attention)')
      expect([v['--claude'], v['--codex'], v['--omp']], th.id).toEqual(['#d77757', '#7a9dff', '#c467e0'])
    }
  })

  it('first paint (main.css) has the same defaults', () => {
    const css = readFileSync(new URL('../app/assets/css/main.css', import.meta.url), 'utf8')
    const root = css.match(/:root\s*\{([^}]*)\}/)![1]!
    expect(root).toContain('--attention: var(--rose);')
    expect(root).toContain('--heading: var(--mauve);')
    expect(root).toContain('--meter: var(--teal);')
    expect(root).toContain('--bar-w: 2px;')
  })
})

describe('Foxur', () => {
  it('is quiet: no side bars, no tints, gray titles, logos and quota bars', () => {
    const v = themeVars(foxur)
    expect(foxur.group).toBe('wherdr')
    expect(v['--bar-w']).toBe('0px')
    expect(v['--attention-edge']).toBe('var(--line)')
    expect(v['--attention-bg']).toBe('var(--bg-2)')
    expect(v['--attention-fill']).toBe('transparent')
    expect(v['--heading']).toBe(foxur.c.muted)
    expect([v['--claude'], v['--codex'], v['--omp']]).toEqual([foxur.c.muted, foxur.c.muted, foxur.c.muted])
    // One loud color: the red antenna cap, for what waits for you.
    expect(v['--attention']).toBe('#e0675f')
    expect(v['--blocked']).toBe('#e0675f')
    expect(themesCss()).toContain(':root[data-theme="foxur"]')
  })
})

describe('custom themes', () => {
  it('lays the changed colors over the base', () => {
    const def = customThemeDef({ id: 'custom-abc123', label: 'Mine', base: 'nord', c: { accent: '#ff0000' }, bars: false })
    expect(def.base).toBe('nord')
    expect(def.c.accent).toBe('#ff0000')
    expect(def.c.bg).toBe(themeById('nord')!.c.bg)
    expect(themeVars(def)['--bar-w']).toBe('0px')
    expect(themeVars(def)['--attention-fill']).not.toBe('transparent')
  })

  it('keeps only #rrggbb colors and known keys', () => {
    const ct = sanitizeCustomTheme({
      id: 'custom-x1', label: '  Evil   theme ', base: 'nord',
      c: { accent: '#AABBCC', bg: 'red;}body{display:none', text: 'url(x)', nope: '#000000', heading: '#123456' },
      bars: 'yes', tints: false,
    })
    expect(ct).toEqual({ id: 'custom-x1', label: 'Evil theme', base: 'nord', c: { accent: '#aabbcc', heading: '#123456' }, tints: false })
    expect(sanitizeCustomTheme({ base: 'no-such-theme', c: {} })).toBeNull()
    expect(sanitizeCustomTheme('nope')).toBeNull()
  })

  it('reads the stored list, skipping broken entries and duplicates', () => {
    const raw = JSON.stringify([
      { id: 'custom-a', label: 'A', base: 'nord', c: {} },
      { id: 'custom-a', label: 'A again', base: 'nord', c: {} },
      { id: 'bad id', label: 'B', base: 'nord', c: {} },
      { id: 'custom-c', label: 'C', base: 'gone', c: {} },
      null,
    ])
    expect(parseCustomThemes(raw).map(t => t.id)).toEqual(['custom-a'])
    expect(parseCustomThemes('{not json')).toEqual([])
    expect(parseCustomThemes(null)).toEqual([])
    expect(storedThemeChoice('custom-a', 'follow', ['custom-a'])).toBe('custom-a')
    expect(storedThemeChoice('custom-a', 'follow')).toBe('wherdr-titanium')
  })

  it('copies a built-in theme as is, and a custom one with its changes', () => {
    const fromBuiltIn = copyTheme(foxur, [], 'My Foxur')
    expect(fromBuiltIn).toMatchObject({ label: 'My Foxur', base: 'foxur', c: {} })
    expect(fromBuiltIn.id).toMatch(/^custom-[a-z0-9]{6}$/)
    const mine = customThemeDef({ id: 'custom-m', label: 'M', base: 'foxur', c: { accent: '#00ff00' }, bars: true })
    expect(copyTheme(mine, [], 'copy')).toMatchObject({ base: 'foxur', c: { accent: '#00ff00' }, bars: true })
  })

  it('shares a theme as a code and imports it with a new id', () => {
    const ct = { id: 'custom-share', label: 'Shared', base: 'foxur', c: { accent: '#00ff00' }, tints: true }
    const code = exportCustomTheme(ct)
    expect(code).not.toContain('custom-share')
    const back = importCustomTheme(code, ['custom-share'])!
    expect(back).toMatchObject({ label: 'Shared', base: 'foxur', c: { accent: '#00ff00' }, tints: true })
    expect(back.id).not.toBe('custom-share')
    expect(importCustomTheme('hello', [])).toBeNull()
  })

  it('never reuses a taken id', () => {
    const seq = [0, 0, 0.5]
    const rnd = () => seq.shift()!
    expect(newCustomId(['custom-000000'], rnd)).not.toBe('custom-000000')
  })

  it('gives the editor a value for every color, derived when the theme has none', () => {
    for (const g of EDITOR_GROUPS) for (const { key } of g.keys) expect(effectiveColor(titanium, key), key).toMatch(/^#[0-9a-f]{6}$/i)
    expect(effectiveColor(titanium, 'attention')).toBe(titanium.c.rose)
    expect(effectiveColor(foxur, 'heading')).toBe(foxur.c.muted)
  })
})
