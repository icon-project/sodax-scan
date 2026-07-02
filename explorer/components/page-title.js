'use client'

export default function PageTitle({ title }) {
    // Brand headline: the leading word gets the single Shrikhand italic accent
    // in yellow-soda, the rest stays white Inter (see design system rule).
    const [accent, ...rest] = String(title).split(' ')
    return (
        <div className="pt-5 pb-2 xl:pt-10 xl:pb-5 flex items-end justify-between w-full gap-4">
            <h1 className="text-3xl xl:text-4xl text-white tracking-tight pb-2">
                <span className="font-display italic text-soda-bright">{accent}</span>
                {rest.length > 0 ? ` ${rest.join(' ')}` : ''}
            </h1>
        </div>
    )
}
