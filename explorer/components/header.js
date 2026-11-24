'use client'
import { Dropdown } from 'flowbite-react'
import SearchBar from '@/components/searchbar'
import Image from 'next/image'

export default function Header({ showSearchBar, assets }) {
    assets = Array.isArray(assets) ? assets : []

    const tickerItems = assets
        .filter((asset) => asset.current_price != null)
        .map((asset) => (
            <li key={asset.name}>
                <div className="flex items-center gap-1 whitespace-nowrap">
                    <Image src={asset.image} alt="" width={20} height={20} className="rounded-full h-[20px] w-[20px]" />
                    <span className="sr-only">{asset.symbol}</span>
                    <span className="tabular-nums">${asset.current_price.toFixed(2)}</span>
                    <span className="tabular-nums text-fg">
                        {/* Arrow carries the direction colour (graphic, 3:1 is enough); the figure stays espresso for 4.5:1 text contrast. */}
                        <span aria-hidden="true" className={asset.price_change_percentage_24h > 0 ? 'text-trend-up' : 'text-trend-down'}>
                            {asset.price_change_percentage_24h > 0 ? '▲' : '▼'}
                        </span>{' '}
                        {Math.abs(asset.price_change_percentage_24h ?? 0).toFixed(2)}%
                    </span>
                </div>
            </li>
        ))

    return (
        <header className="px-4 py-4 xl:px-24 2xl:px-48 w-full bg-header flex items-center md:items-stretch justify-between max-md:gap-3 border-b border-line">
            <div className="min-w-0">
                <a className="block rounded-small" href="/" aria-label="SODAX Scan home">
                    <img alt="" className="w-44 min-w-0 md:w-64 md:min-w-64 h-[32px] max-md:object-contain max-md:object-left" src="/images/new_logo.svg"></img>
                </a>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <div className="xl:flex items-center gap-4 px-2 text-sm hidden">
                    {/* Seamless ticker: the list is rendered twice side by side and both copies
                        slide left by their own width, so the second copy takes the first one's
                        place exactly when the animation restarts (no visible jump). */}
                    <div className="ticker w-full max-w-[820px] 3xl:max-w-6xl inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]">
                        {[false, true].map((duplicate) => (
                            <ul key={duplicate ? 'copy' : 'main'} aria-hidden={duplicate || undefined} className="flex shrink-0 items-center justify-start [&_li]:mx-4 animate-infinite-scroll">
                                {tickerItems}
                            </ul>
                        ))}
                    </div>
                </div>

                {showSearchBar ? <SearchBar showFull={false} /> : ''}

                <Dropdown label="" dismissOnClick={false} renderTrigger={() => (
                        <button type="button" aria-label="SODAX apps" className="inline-flex items-center justify-center rounded-small transition-colors duration-150 hover:bg-subtle max-md:p-2.5 max-md:-m-2.5">
                            <Image alt="" className="hover:cursor-pointer" src={`/images/sodax_logo.svg`} width={24} height={24} />
                        </button>
                    )}>
                    <Dropdown.Item>
                        <a href={process.env.NEXT_PUBLIC_TESTNET_APP_URL}>Testnet</a>
                    </Dropdown.Item>
                    <Dropdown.Item>
                        <a href={process.env.NEXT_PUBLIC_MAINNET_APP_URL}>Mainnet</a>
                    </Dropdown.Item>
                </Dropdown>
            </div>
        </header>
    )
}
