import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InputBar } from '../InputBar'

describe('InputBar', () => {
  it('calls onSend with message when submit clicked', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i)
    fireEvent.change(input, { target: { value: 'Merhaba!' } })
    fireEvent.click(screen.getByRole('button', { name: /إرسال|Send/i }))

    expect(onSend).toHaveBeenCalledWith('Merhaba!')
  })

  it('clears input after send', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.click(screen.getByRole('button', { name: /إرسال|Send/i }))

    expect(input.value).toBe('')
  })

  it('disables send when disabled prop is true', () => {
    render(<InputBar onSend={vi.fn()} disabled={true} />)
    expect(screen.getByRole('button', { name: /إرسال|Send/i })).toBeDisabled()
  })

  it('sends on Enter key press', () => {
    const onSend = vi.fn()
    render(<InputBar onSend={onSend} disabled={false} />)

    const input = screen.getByPlaceholderText(/اكتب|Write/i)
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSend).toHaveBeenCalledWith('test')
  })
})
