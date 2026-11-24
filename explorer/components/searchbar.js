'use client'
import { MagnifyingGlassIcon } from '@heroicons/react/24/solid'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function SearchBar({ showFull }) {
    const [searchValue, setSearchValue] = useState('')
    const router = useRouter()
    const keydownEnter = (e) => {
        if (e.key === 'Enter') {
            router.push(`/messages/search?value=${e.target.value}`)
        }
    }

    // Brand focus ring via focus-visible: yellow-soda over the cherry hero (full),
    // cherry-soda on the light header (compact). Radius: design-system `medium`.
    const inputClass = showFull
        ? `block w-full p-3 pl-10 xl:pl-12 text-sm xl:text-lg bg-chalk text-espresso placeholder:text-clay border border-clay-light rounded-medium focus:outline-none focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-soda-bright`
        : `block w-full p-2 pl-10 text-sm xl:text-sm bg-chalk text-espresso placeholder:text-clay border border-clay-light rounded-medium focus:outline-none focus-visible:border-cherry-soda focus-visible:ring-2 focus-visible:ring-cherry-soda/40`
    const wrappedInputClass = showFull ? `relative shadow-card rounded-medium w-full` : ` w-[15rem] hidden xl:inline-block relative xl:w-[28rem]`
    const iconClass = showFull ? 'w-6 h-6 text-clay' : 'w-5 h-5 text-clay'

    return (
        <div>
            <div className={wrappedInputClass}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <MagnifyingGlassIcon className={iconClass} />
                </div>
                <input type="search" id="value" name="value" className={inputClass} placeholder="Search by transaction hash / serial no" required onKeyDown={keydownEnter} />
            </div>
        </div>
    )
}
