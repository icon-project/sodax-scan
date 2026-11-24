'use client'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDoubleLeftIcon, ChevronLeftIcon, ChevronRightIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline'

const BTN =
    'inline-flex items-center justify-center w-10 h-10 rounded-small border border-line-control bg-raised text-fg transition-colors duration-150 ' +
    'hover:bg-hover active:bg-subtle focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
const BTN_DISABLED = 'inline-flex items-center justify-center w-10 h-10 rounded-small border border-line bg-header text-fg-disabled cursor-not-allowed'

function PageControl({ label, icon: Icon, disabled, href, onClick }) {
    const icon = <Icon width={18} height={18} aria-hidden="true" />
    if (disabled) {
        return (
            <span role="link" aria-disabled="true" aria-label={label} className={BTN_DISABLED}>
                {icon}
            </span>
        )
    }
    if (href) {
        return (
            <Link aria-label={label} className={BTN} href={href}>
                {icon}
            </Link>
        )
    }
    return (
        <button type="button" aria-label={label} className={BTN} onClick={onClick}>
            {icon}
        </button>
    )
}

// Shared pagination bar used by the home list (callbacks) and /messages (links):
// icon buttons first/prev/next/last with disabled ends, "Page X of N" in tabular
// numerals and a quiet page-size select. Wraps instead of overflowing at 375px.
// Pass `hrefFor(page)` for link mode or `onPage(page)` for button mode.
export function PaginationBar({ pageNumber, totalPages, pageSize, sizes = [10, 20, 50, 100], onSize, onPage, hrefFor }) {
    const total = Math.max(1, Number(totalPages) || 1)
    const page = Math.min(Math.max(1, Number(pageNumber) || 1), total)
    const atStart = page <= 1
    const atEnd = page >= total
    const control = (label, icon, target, disabled) => (
        <PageControl label={label} icon={icon} disabled={disabled} href={hrefFor ? hrefFor(target) : undefined} onClick={() => onPage && onPage(target)} />
    )

    return (
        <nav aria-label="Pagination" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-4 px-1 text-sm text-fg">
            <div className="flex items-center gap-1.5">
                {control('First page', ChevronDoubleLeftIcon, 1, atStart)}
                {control('Previous page', ChevronLeftIcon, page - 1, atStart)}
                <span aria-current="page" className="px-2 tabular-nums whitespace-nowrap">
                    Page {page} of {total}
                </span>
                {control('Next page', ChevronRightIcon, page + 1, atEnd)}
                {control('Last page', ChevronDoubleRightIcon, total, atEnd)}
            </div>
            <label className="flex items-center gap-1 text-fg-muted">
                <span>Rows</span>
                <select
                    name="ps"
                    className="h-10 min-w-[4.5rem] rounded-small border border-transparent bg-transparent px-2 text-fg cursor-pointer transition-colors duration-150 hover:bg-hover hover:border-line-control focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    value={pageSize}
                    onChange={(e) => onSize(e.target.value)}
                >
                    {sizes.map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
            </label>
        </nav>
    )
}

// Link-driven variant (/messages): page changes are plain links, page size
// pushes a new URL (unchanged behaviour).
const Pagination = ({ totalPages, pageSize, pageNumber }) => {
    const [selectedOption, setSelectedOption] = useState(pageSize)
    const router = useRouter()

    return (
        <PaginationBar
            pageNumber={pageNumber}
            totalPages={totalPages}
            pageSize={selectedOption}
            hrefFor={(p) => `/messages?ps=${pageSize}&p=${p}`}
            onSize={(value) => {
                setSelectedOption(value)
                router.push(`/messages/?ps=${value}&p=1`)
            }}
        />
    )
}
export default Pagination
