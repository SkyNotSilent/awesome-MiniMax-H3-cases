import { Component, type ReactNode } from 'react'

// Contains failures of lazily loaded chunks (for example after a deploy removes
// old assets) so one missing chunk shows a fallback instead of blanking the app.
export default class LazyBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
