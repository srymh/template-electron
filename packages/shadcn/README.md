shadcn create のデザインを反映するために [https://github.com/shadcn-ui/ui](https://github.com/shadcn-ui/ui) を手動でコピー・調整しました。

- Source: https://github.com/shadcn-ui/ui/tree/c2e1a5793fe93c44cc6128b5603c8452ca4a84bc
- Tag: `shadcn@4.6.0`
- Commit Hash: `c2e1a5793fe93c44cc6128b5603c8452ca4a84bc`

```plain
apps/v4/registry/bases/radix/ui/*.tsx                    -> src/components/ui/*.tsx
apps/v4/registry/bases/radix/lib/utils.ts                -> src/lib/utils.ts
apps/v4/app/(app)/create/components/icon-placeholder.tsx -> src/components/ui/helper/icon-placeholder.tsx
apps/v4/registry/bases/radix/hooks/use-mobile.ts         -> src/hooks/use-mobile.ts

apps/v4/registry/bases/radix/examples/*.tsx              -> src/demo/components/*.tsx
apps/v4/registry/themes.ts                               -> src/themes.ts

apps/v4/app/globals.css                                  -> src/styles.css
apps/v4/app/legacy-themes.css                            -> src/styles/legacy-themes.css
apps/v4/registry/styles/style-*.css                      -> src/styles/style-*.css
packages/shadcn/src/tailwind.css                         -> src/styles/tailwind.css

apps/v4/registry/icons/*.{ts,tsx}                        -> src/icons/*.{ts,tsx}
packages/shadcn/src/icons/libraries.ts                   -> src/icons/libraries.ts
```

```plain
MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
