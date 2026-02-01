/**
 * https://github.com/shadcn-ui/ui/blob/afa2a7adf2d5a63ccaf85a00987f9535ebdae4fb/apps/v4/registry/bases/radix/components/example.tsx
 *
 * MIT License
 *
 * Copyright (c) 2023 shadcn
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { cn } from '@/lib/utils'

function ExampleWrapper({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div className="bg-background w-full">
      <div
        data-slot="example-wrapper"
        className={cn(
          'mx-auto grid min-h-screen w-full max-w-5xl min-w-0 content-center items-start gap-8 p-4 pt-2 sm:gap-12 sm:p-6 md:grid-cols-2 md:gap-8 lg:p-12 2xl:max-w-6xl',
          className,
        )}
        {...props}
      />
    </div>
  )
}

function Example({
  title,
  children,
  className,
  containerClassName,
  ...props
}: React.ComponentProps<'div'> & {
  title?: string
  containerClassName?: string
}) {
  return (
    <div
      data-slot="example"
      className={cn(
        'mx-auto flex w-full max-w-lg min-w-0 flex-col gap-1 self-stretch lg:max-w-none',
        containerClassName,
      )}
      {...props}
    >
      {title && (
        <div className="text-muted-foreground px-1.5 py-2 text-xs font-medium">
          {title}
        </div>
      )}
      <div
        data-slot="example-content"
        className={cn(
          "bg-background text-foreground flex min-w-0 flex-1 flex-col items-start gap-6 border border-dashed p-4 sm:p-6 *:[div:not([class*='w-'])]:w-full",
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}

export { ExampleWrapper, Example }
