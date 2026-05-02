import type { IconLibraryName } from "../icons/libraries";

export function useDesignSystemSearchParams(): [{
    iconLibrary: IconLibraryName,
    style: string,
}] {
    return [{
        iconLibrary: 'lucide',
        style: 'lyra'
    }] as const
}
