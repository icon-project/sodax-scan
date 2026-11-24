'use client'
import { Dropdown } from 'flowbite-react'
import SearchBar from '@/components/searchbar'
import Image from 'next/image'

export default function Header({ showSearchBar, assets }) {
    assets = assets ?? []

    return (
        <header className="px-4 py-4 xl:px-24 2xl:px-48 w-full bg-almost-white flex items-center md:items-stretch justify-between max-md:gap-3 border-b border-light-grey">
            <div className="min-w-0">
                <a className="block" href="/">
                    <img alt="SODAX Scan" className="w-44 min-w-0 md:w-64 md:min-w-64 h-[32px] object-contain object-left" src="/images/new_logo.svg"></img>
                </a>
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <div className="xl:flex items-center gap-4 px-2 text-sm hidden">
                    <div
                        x-data="{}"
                        x-init="$nextTick(() => {
                        let ul = $refs.logos;
                        ul.insertAdjacentHTML('afterend', ul.outerHTML);
                        ul.nextSibling.setAttribute('aria-hidden', 'true');
                    })"
                        className="w-full max-w-[820px] 3xl:max-w-6xl inline-flex flex-nowrap overflow-hidden [mask-image:_linear-gradient(to_right,transparent_0,_black_128px,_black_calc(100%-128px),transparent_100%)]"
                    >
                        <ul x-ref="logos" className="flex items-center justify-center md:justify-start [&_li]:mx-4 animate-infinite-scroll">
                            {Array.isArray(assets)
                                ? assets.filter((asset) => asset.current_price != null).map((asset) => (
                                      <li key={asset.name}>
                                          <div key={asset.name} className="flex items-center gap-1 whitespace-nowrap">
                                              <Image src={asset.image} width={20} height={20} className="rounded-full h-[20px] w-[20px]" />
                                              <span className="tabular-nums">${asset.current_price.toFixed(2)}</span>
                                              <span className="tabular-nums text-espresso">
                                                  {/* Arrow carries the direction colour (graphic, 3:1 is enough); the figure stays espresso for 4.5:1 text contrast. */}
                                                  <span aria-hidden="true" className={asset.price_change_percentage_24h > 0 ? 'text-success-dark' : 'text-error-dark'}>
                                                      {asset.price_change_percentage_24h > 0 ? '▲' : '▼'}
                                                  </span>{' '}
                                                  {Math.abs(asset.price_change_percentage_24h ?? 0).toFixed(2)}%
                                              </span>
                                          </div>
                                      </li>
                                  ))
                                : null}
                        </ul>
                    </div>
                </div>

                {showSearchBar ? <SearchBar showFull={false} /> : ''}

                <Dropdown label="" dismissOnClick={false} renderTrigger={() => <Image alt="SODAX apps" className="hover:cursor-pointer max-md:box-content max-md:p-2.5 max-md:-m-2.5" src={`/images/sodax_logo.svg`} width={24} height={24} />}>
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
