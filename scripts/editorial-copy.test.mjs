import { describe, expect, it } from 'vitest'
import { editorialCopyErrors, genericEditorialCopyPattern, requireEditorialCopy } from './editorial-copy.mjs'

const validCopy = {
  title: '九种加速组合同 Seed 对比',
  titleEn: 'Nine Acceleration Setups, One Seed',
  summary: '同一提示词与 Seed 下对比九种 H3 加速组合，画面结果存在明显差异。',
  summaryEn: 'Nine H3 acceleration setups use the same prompt and seed, producing visibly different results.',
  basis: 'source-caption',
}

describe('editorial copy', () => {
  it('accepts concise content-first bilingual copy', () => {
    expect(editorialCopyErrors(validCopy)).toEqual([])
    expect(requireEditorialCopy({ id: 'x-1', editorialCopy: validCopy })).toEqual(validCopy)
  })

  it('rejects account-led and generic case templates', () => {
    const errors = editorialCopyErrors({
      ...validCopy,
      title: '@creator 的 MiniMax H3 社区视频案例',
      titleEn: 'MiniMax H3 Community Video Example by @creator',
    })
    expect(errors.some((error) => error.includes('account handles'))).toBe(true)
    expect(errors.some((error) => error.includes('generic case template'))).toBe(true)
    expect(genericEditorialCopyPattern('@creator 的 MiniMax H3 社区视频案例')).toBe(true)
  })

  it('fails closed when reviewed editorial copy is missing', () => {
    expect(() => requireEditorialCopy({ id: 'x-missing' })).toThrow('editorialCopy is required')
  })

  it('keeps generic media words out of public titles', () => {
    expect(editorialCopyErrors({ ...validCopy, title: '九种加速组合测试' }))
      .toContain('editorialCopy.title must omit generic media/template terms')
    expect(editorialCopyErrors({ ...validCopy, titleEn: 'Nine Acceleration Tests' }))
      .toContain('editorialCopy.titleEn must omit generic media/template terms')
  })

  it('keeps model names and generation modes in metadata fields', () => {
    expect(editorialCopyErrors({ ...validCopy, title: 'MiniMax H3 的九种加速组合' }))
      .toContain('editorialCopy.title must keep model and generation-mode metadata out of the title')
    expect(editorialCopyErrors({ ...validCopy, titleEn: 'A Ref2VA Character Study' }))
      .toContain('editorialCopy.titleEn must keep model and generation-mode metadata out of the title')
  })
})
