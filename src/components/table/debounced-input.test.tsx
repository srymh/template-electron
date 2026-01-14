import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { DebouncedInput } from '@/components/table/debounced-input'

describe('DebouncedInput', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call onChange again when only onChange identity changes', () => {
    vi.useFakeTimers()

    const onChange1 = vi.fn()
    const { rerender } = render(
      <DebouncedInput value="abc" onChange={onChange1} debounce={10} />,
    )

    vi.advanceTimersByTime(10)
    expect(onChange1).not.toHaveBeenCalled()

    onChange1.mockClear()

    // rerender with same value but new onChange ref (like column.setFilterValue closures)
    const onChange2 = vi.fn()
    rerender(<DebouncedInput value="abc" onChange={onChange2} debounce={10} />)

    vi.advanceTimersByTime(10)

    expect(onChange1).not.toHaveBeenCalled()
    expect(onChange2).not.toHaveBeenCalled()
  })

  it('calls onChange when user changes the value', () => {
    vi.useFakeTimers()

    const onChange = vi.fn()
    const { getByRole } = render(
      <DebouncedInput value="" onChange={onChange} debounce={10} />,
    )

    vi.advanceTimersByTime(10)
    expect(onChange).not.toHaveBeenCalled()

    fireEvent.change(getByRole('textbox'), { target: { value: 'x' } })
    vi.advanceTimersByTime(10)

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith('x')
  })
})
