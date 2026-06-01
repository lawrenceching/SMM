import { describe, expect, it } from 'vitest'
import {
  comboboxItemsFromOptions,
  findPresetByName,
  getModelOptions,
} from './ai-provider-presets'

describe('ai-provider-presets', () => {
  it('findPresetByName matches exact preset names', () => {
    const preset = findPresetByName('DeepSeek')
    expect(preset?.baseUrl).toBe('https://api.deepseek.com')
    expect(preset?.models).toContain('deepseek-chat')
  })

  it('findPresetByName returns undefined for unknown names', () => {
    expect(findPresetByName('My Custom AI')).toBeUndefined()
    expect(findPresetByName('  ')).toBeUndefined()
  })

  it('getModelOptions returns preset models and prepends custom model', () => {
    const options = getModelOptions('OpenAI', 'my-fine-tuned')
    expect(options[0]).toBe('my-fine-tuned')
    expect(options).toContain('gpt-4o')
  })

  it('getModelOptions returns only custom model when no preset', () => {
    expect(getModelOptions('Custom', 'model-x')).toEqual(['model-x'])
  })

  it('comboboxItemsFromOptions includes custom value first', () => {
    expect(comboboxItemsFromOptions(['a', 'b'], 'custom')).toEqual(['custom', 'a', 'b'])
  })
})
