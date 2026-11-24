'use client'

// Brand headline (design system): Inria Serif display title with ONE short
// Shrikhand italic accent word (<= 4 chars, lowercase, yellow-soda). Everything
// else on the page stays Inter. `before` / `after` are the Inria Serif text on
// either side of the accent word.
export function Headline({ before = '', accent, after = '', className = '' }) {
    return (
        <h1 className={`font-serif-heading text-4xl xl:text-5xl text-white tracking-tight leading-tight ${className}`}>
            {before ? `${before} ` : ''}
            <span className="font-display italic text-soda-bright">{accent}</span>
            {after ? ` ${after}` : ''}
        </h1>
    )
}

export default function PageTitle(props) {
    return (
        <div className="pt-5 pb-2 xl:pt-10 xl:pb-5 flex items-end justify-between w-full gap-4">
            <Headline {...props} className="pb-2" />
        </div>
    )
}
