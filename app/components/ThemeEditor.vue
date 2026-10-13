<script setup lang="ts">
// Custom theme (Settings › Appearance › Theme): start from the theme shown, change any
// color, turn the side bars and tinted backgrounds off, share it as a code. Every
// change applies right away (useTheme.ts) and is kept on the device.
import type { CustomTheme, EditableColor } from '~/utils/customThemes'

const current = computed<CustomTheme | undefined>(() => customThemes.value.find(t => t.id === themeChoice.value))
const def = computed(() => (current.value ? customThemeDef(current.value) : undefined))
const baseDef = computed(() => (current.value ? themeById(current.value.base) : undefined))
const importing = ref(false)
const importText = ref('')

function customize() {
  const from = resolveTheme(themeChoice.value === FOLLOW_HERDR ? activeTheme.value.def.id : themeChoice.value) || activeTheme.value.def
  const label = from.id.startsWith(CUSTOM_PREFIX) ? tl(`${from.label} copy`, `Copie de ${from.label}`) : tl(`My ${from.label}`, `Mon ${from.label}`)
  const ct = copyTheme(from, customThemes.value.map(t => t.id), label.slice(0, 40))
  customThemes.value = [...customThemes.value, ct]
  themeChoice.value = ct.id
  haptic()
}

function update(patch: Partial<CustomTheme>) {
  const ct = current.value
  if (!ct) return
  customThemes.value = customThemes.value.map(t => (t.id === ct.id ? { ...t, ...patch } : t))
}

function setColor(key: EditableColor, v: string) {
  if (!current.value || !/^#[0-9a-f]{6}$/i.test(v)) return
  update({ c: { ...current.value.c, [key]: v.toLowerCase() } })
}
function resetColor(key: EditableColor) {
  if (!current.value) return
  const { [key]: _drop, ...rest } = current.value.c
  update({ c: rest })
}
const changed = (key: EditableColor) => Boolean(current.value?.c[key])
const colorOf = (key: EditableColor) => (def.value ? effectiveColor(def.value, key) : '#000000')

function setBase(id: string) {
  update({ base: id })
}
const bases = computed(() => THEMES.map(t => ({ label: t.label, value: t.id })))
const baseId = computed({ get: () => current.value?.base || DEFAULT_THEME, set: setBase })
const label = computed({
  get: () => current.value?.label || '',
  set: (v: string) => update({ label: v.slice(0, 40) }),
})
const barsOn = computed({ get: () => def.value?.bars !== false, set: (v: boolean) => update({ bars: v }) })
const tintsOn = computed({ get: () => def.value?.tints !== false, set: (v: boolean) => update({ tints: v }) })

async function copyCode() {
  if (!current.value) return
  try {
    await navigator.clipboard.writeText(exportCustomTheme(current.value))
    toast(t('Theme code copied'))
  } catch { toast(t('Could not copy the theme code'), true) }
}

function doImport() {
  const ct = importCustomTheme(importText.value, customThemes.value.map(t => t.id))
  if (!ct) { toast(t('Not a wherdr theme code'), true); return }
  customThemes.value = [...customThemes.value, ct]
  themeChoice.value = ct.id
  importing.value = false
  importText.value = ''
  haptic()
}

function remove() {
  const ct = current.value
  if (!ct) return
  customThemes.value = customThemes.value.filter(t => t.id !== ct.id)
  themeChoice.value = ct.base
}
</script>

<template>
  <div class="theme-editor">
    <div class="theme-editor-actions">
      <button type="button" class="theme-editor-btn" @click="customize">
        <UIcon name="i-lucide-palette" />{{ t(current ? 'Duplicate' : 'Customize') }}
      </button>
      <button type="button" class="theme-editor-btn" :aria-expanded="importing" @click="importing = !importing">
        <UIcon name="i-lucide-clipboard-paste" />{{ t('Import theme') }}
      </button>
    </div>
    <div v-if="importing" class="theme-import">
      <textarea v-model="importText" rows="3" spellcheck="false" :placeholder="t('Paste a theme code')" :aria-label="t('Theme code')" />
      <button type="button" class="theme-editor-btn" :disabled="!importText.trim()" @click="doImport">{{ t('Import') }}</button>
    </div>

    <div v-if="current && def" class="theme-edit">
      <label class="theme-edit-row">
        <span>{{ t('Name') }}</span>
        <input v-model="label" type="text" maxlength="40" class="theme-edit-text">
      </label>
      <label class="theme-edit-row">
        <span>{{ t('Starts from') }}</span>
        <select v-model="baseId" class="theme-edit-text">
          <option v-for="b in bases" :key="b.value" :value="b.value">{{ b.label }}</option>
        </select>
      </label>

      <label class="settings-toggle">
        <span><b>{{ t('Colored side bars') }}</b><small>{{ t('The colored line on the left of cards and requests. Off: a plain line.') }}</small></span>
        <USwitch v-model="barsOn" color="success" size="xl" />
      </label>
      <label class="settings-toggle">
        <span><b>{{ t('Tinted backgrounds') }}</b><small>{{ t('The colored background behind a card waiting for you and its answers.') }}</small></span>
        <USwitch v-model="tintsOn" color="success" size="xl" />
      </label>

      <section v-for="g in EDITOR_GROUPS" :key="g.title" class="theme-edit-group">
        <h4 class="theme-section-title">{{ t(g.title) }}</h4>
        <div class="theme-edit-colors">
          <label v-for="k in g.keys" :key="k.key" class="theme-color" :class="{ changed: changed(k.key) }">
            <input type="color" :value="colorOf(k.key)" @input="setColor(k.key, ($event.target as HTMLInputElement).value)">
            <span class="theme-color-name">{{ t(k.label) }}<small>{{ colorOf(k.key) }}</small></span>
            <button
              v-if="changed(k.key)" type="button" class="theme-color-reset" :aria-label="tl(`Reset ${t(k.label)} to ${baseDef?.label}`, `Rétablir ${t(k.label)} de ${baseDef?.label}`)"
              @click.prevent="resetColor(k.key)"
            >
              <UIcon name="i-lucide-rotate-ccw" />
            </button>
          </label>
        </div>
      </section>

      <div class="theme-editor-actions">
        <button type="button" class="theme-editor-btn" @click="copyCode"><UIcon name="i-lucide-copy" />{{ t('Copy theme code') }}</button>
        <button type="button" class="theme-editor-btn danger" @click="remove"><UIcon name="i-lucide-trash-2" />{{ t('Delete theme') }}</button>
      </div>
    </div>
  </div>
</template>
