import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App'

afterEach(cleanup)

describe('case catalog', () => {
  it('filters cases by generation mode', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: /全模态参考/ }))
    expect(screen.getByText('粉色西装与黑色羔羊')).toBeInTheDocument()
    expect(screen.queryByText('舰桥上的跃迁余震')).not.toBeInTheDocument()
  })

  it('searches across case tags', () => {
    render(<App />)
    fireEvent.change(screen.getByPlaceholderText('搜索提示词、场景、标签…'), {
      target: { value: '焦点转移' },
    })
    expect(screen.getByText('拉面与家庭晚餐')).toBeInTheDocument()
    expect(screen.queryByText('粉色西装与黑色羔羊')).not.toBeInTheDocument()
  })
})
