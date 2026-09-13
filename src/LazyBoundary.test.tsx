import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import LazyBoundary from './LazyBoundary'

function Broken(): never {
  throw new Error('chunk failed')
}

it('shows its fallback when a lazy child fails to load', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  render(<LazyBoundary fallback={<p>fallback shown</p>}><Broken /></LazyBoundary>)
  expect(screen.getByText('fallback shown')).toBeInTheDocument()
  consoleError.mockRestore()
})
