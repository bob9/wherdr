import { afterEach, describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ThemeEditor from '~/components/ThemeEditor.vue'
import { activeTheme, customThemes, themeChoice } from '~/composables/useTheme'

afterEach(() => {
  customThemes.value = []
  themeChoice.value = 'foxur'
})

const button = (w: Awaited<ReturnType<typeof mountSuspended>>, text: string) =>
  w.findAll('button').find(b => b.text() === text)!

describe('ThemeEditor', () => {
  it('copies the theme shown into an editable theme and applies a changed color', async () => {
    themeChoice.value = 'foxur'
    const w = await mountSuspended(ThemeEditor)
    expect(w.find('.theme-edit').exists()).toBe(false)
    await button(w, 'Customize').trigger('click')

    expect(customThemes.value).toHaveLength(1)
    const ct = customThemes.value[0]!
    expect(ct).toMatchObject({ label: 'My Foxur', base: 'foxur' })
    expect(themeChoice.value).toBe(ct.id)
    expect(w.find('.theme-edit').exists()).toBe(true)
    expect(button(w, 'Duplicate').exists()).toBe(true)

    const attention = w.findAll('.theme-color').find(l => l.text().startsWith('Waiting for you'))!
    await attention.find('input[type=color]').setValue('#ff8800')
    expect(customThemes.value[0]!.c).toMatchObject({ attention: '#ff8800' })
    expect(activeTheme.value.custom['--attention']).toBe('#ff8800')
    expect(activeTheme.value.custom['--bar-w']).toBe('0px')

    await attention.find('.theme-color-reset').trigger('click')
    expect(customThemes.value[0]!.c.attention).toBeUndefined()
    w.unmount()
  })

  it('imports a shared theme code and deletes it back to its base', async () => {
    const w = await mountSuspended(ThemeEditor)
    await button(w, 'Import theme').trigger('click')
    await w.find('textarea').setValue('not a theme')
    await button(w, 'Import').trigger('click')
    expect(customThemes.value).toHaveLength(0)

    await w.find('textarea').setValue(JSON.stringify({ wherdrTheme: 1, label: 'Shared', base: 'catppuccin', c: { accent: '#123456' }, bars: false }))
    await button(w, 'Import').trigger('click')
    expect(customThemes.value).toMatchObject([{ label: 'Shared', base: 'catppuccin', c: { accent: '#123456' }, bars: false }])
    expect(themeChoice.value).toBe(customThemes.value[0]!.id)
    expect(activeTheme.value.custom['--accent']).toBe('#123456')

    await button(w, 'Delete theme').trigger('click')
    expect(customThemes.value).toHaveLength(0)
    expect(themeChoice.value).toBe('catppuccin')
    w.unmount()
  })
})
