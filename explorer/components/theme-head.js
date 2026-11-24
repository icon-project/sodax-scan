import { THEME_SCRIPT } from '@/lib/theme-script'
import { THEME_COLORS } from '@/lib/theme'

// <head> children shared by every root layout (index, messages, debug) so the
// three cannot drift: colour-scheme hint, theme-color meta (kept in sync by the
// script and the picker) and the blocking no-flash theme script. The script must
// follow the meta tag so it can update it.
export default function ThemeHead() {
    return (
        <>
            <meta name="color-scheme" content="light dark" />
            <meta name="theme-color" content={THEME_COLORS.light} />
            <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        </>
    )
}
