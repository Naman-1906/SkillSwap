import React, { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-[#fff7f5] px-6 py-10 text-[#3b2218]">
          <div className="mx-auto max-w-3xl rounded-3xl border border-[#efc9bc] bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-black">The app crashed while rendering.</h1>
            <p className="mt-3 text-sm text-[#7b5a4c]">
              This replaces the blank white screen so we can see the actual runtime problem.
            </p>
            <p className="mt-4 rounded-2xl bg-[#fff3ee] px-4 py-3 text-sm font-semibold text-[#7a3420]">
              {String(this.state.error?.message || this.state.error || 'Unknown render error')}
            </p>
            <pre className="mt-5 overflow-auto rounded-2xl bg-[#2b1813] p-4 text-xs text-[#ffe7de]">
              {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>,
)
