import React from 'react'
import { Input } from '@/components/ui/input'

// 一般的なdebounce付きのinputコンポーネント
export function DebouncedInput({
  value: initialValue,
  onChange,
  debounce = 500,
  ...props
}: {
  value: string | number
  onChange: (value: string | number) => void
  debounce?: number
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'>) {
  'use no memo'

  const [value, setValue] = React.useState(initialValue)

  // Only notify when the user edits the input.
  // Syncing from props (including initial mount) must not trigger onChange.
  const shouldNotifyRef = React.useRef(false)

  const onChangeRef = React.useRef(onChange)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  React.useEffect(() => {
    shouldNotifyRef.current = false
    setValue(initialValue)
  }, [initialValue])

  React.useEffect(() => {
    if (!shouldNotifyRef.current) return

    const timeout = setTimeout(() => {
      onChangeRef.current(value)
    }, debounce)

    return () => clearTimeout(timeout)
  }, [value, debounce])

  return (
    <Input
      {...props}
      value={value}
      onChange={(e) => {
        shouldNotifyRef.current = true
        setValue(e.target.value)
      }}
    />
  )
}
