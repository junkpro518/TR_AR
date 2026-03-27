import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MessageBubble } from '../MessageBubble'

describe('MessageBubble', () => {
  it('renders user message on the right', () => {
    render(<MessageBubble role="user" content="Merhaba!" isStreaming={false} />)
    const bubble = screen.getByText('Merhaba!')
    expect(bubble).toBeInTheDocument()
  })

  it('renders assistant message on the left', () => {
    render(<MessageBubble role="assistant" content="Nasılsın?" isStreaming={false} />)
    expect(screen.getByText('Nasılsın?')).toBeInTheDocument()
  })

  it('shows streaming indicator when isStreaming is true', () => {
    render(<MessageBubble role="assistant" content="" isStreaming={true} />)
    expect(screen.getByTestId('streaming-indicator')).toBeInTheDocument()
  })
})
