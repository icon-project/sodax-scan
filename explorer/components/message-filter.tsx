'use client'

import { useState } from 'react'
import { Dropdown, DropdownItem } from 'flowbite-react'
import helper from '@/lib/helper'
import Render from '@/lib/render'
import NetworkIcon from '@/components/network-icon'

interface Network {
    id: string
    name: string
    logo: string
    nativeAsset: string
}

interface MessageFilterProps {
    srcNetwork: string
    destNetwork: string
    actionType: string
    status: string
    kind: string
    srcNetworkChanged: (value: string) => void
    destNetworkChanged: (value: string) => void
    actionTypeChanged: (value: string) => void
    statusChanged: (value: string) => void
    kindChanged: (value: string) => void
    resetClicked: () => void
    // Mobile panel variant: smaller h-9 chips, quiet Reset; className replaces nothing, it is appended to the root.
    compact?: boolean
    className?: string
}

const MessageFilter = (props: MessageFilterProps) => {
    const [srcFilter, setSrcFilter] = useState<string>('')
    const [destFilter, setDestFilter] = useState<string>('')

    // Filter triggers are pills over the cherry hero. Inactive: outlined; active
    // (a filter is set): solid white pill, so a filtered list is obvious at a glance.
    const chipTheme = (active: boolean) => ({
        inlineWrapper: `flex items-center gap-1 rounded-full border px-3 text-sm transition-colors ${props.compact ? 'h-9' : 'py-1.5'} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soda-bright ${
            active
                ? 'bg-white border-white text-cherry-dark font-medium hover:bg-almost-white'
                : 'border-cherry-bright/60 dark:border-cherry-brighter/80 text-white hover:bg-cherry-dark hover:border-cherry-brighter'
        }`
    })

    const filterNetworks = (networks: Network[], filterText: string): Network[] => {
        if (!filterText) return networks
        const lowerFilter = filterText.toLowerCase()
        return networks.filter(network => 
            (network.name.toLowerCase().includes(lowerFilter) || String(helper.networkDisplayName(network.name)).toLowerCase().includes(lowerFilter))
        )
    }

    // Desktop (md+): one right-aligned row. Compact (phone panel): a wrapping row of h-9 chips,
    // since a scroll strip would clip the dropdown menus. Route first, Reset last.
    return (
        <div className={`flex flex-wrap items-center ${props.compact ? '' : 'md:flex-nowrap md:justify-end p-1'} gap-2 text-white rounded-md ${props.className ?? ''}`}>
            <Dropdown label="Route" inline className="rounded-md" theme={chipTheme(props.kind !== '')}>
                <DropdownItem
                    className={`min-w-32 ${props.kind == '' ? 'bg-hover' : ''}`}
                    onClick={() => {
                        props.kindChanged('')
                    }}
                >
                    All Routes
                </DropdownItem>

                {helper.MESSAGE_KINDS.map((kind) => {
                    return (
                        <DropdownItem
                            key={kind.value}
                            className={`${props.kind == kind.value ? 'bg-hover' : ''}`}
                            onClick={() => {
                                props.kindChanged(kind.value)
                            }}
                        >
                            {kind.label}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Status" inline className="rounded-md" theme={chipTheme(props.status !== '')}>
                <DropdownItem
                    className={`min-w-32 ${props.status == '' ? 'bg-hover' : ''}`}
                    onClick={() => {
                        props.statusChanged('')
                    }}
                >
                    All Status
                </DropdownItem>

                {helper.STATUS_FILTERS.map((status) => {
                    return (
                        <DropdownItem
                            key={status}
                            className={`${props.status == status ? 'bg-hover' : ''}`}
                            onClick={() => {
                                props.statusChanged(status)
                            }}
                        >
                            {Render.renderMessageStatus(status)}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Source" inline className="rounded-md" theme={chipTheme(props.srcNetwork !== '')}>
                <div className="p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onKeyPress={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Filter networks..."
                        value={srcFilter}
                        onChange={(e) => setSrcFilter(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 text-sm bg-raised border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-focus text-fg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <DropdownItem
                    className={`min-w-48 ${props.srcNetwork === '' ? 'bg-hover' : ''}`}
                    onClick={() => {
                        props.srcNetworkChanged('')
                    }}
                >
                    All Networks
                </DropdownItem>
                {filterNetworks(helper.getNetworks(), srcFilter).map((network) => {
                    const networkId = helper.NETWORK_MAPPINGS[network.id]
                    return (
                        <DropdownItem
                            key={network.id}
                            className={`min-w-48 ${props.srcNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? 'bg-menu-selected' : ''}`}
                            onClick={() => {
                                props.srcNetworkChanged(network.id)
                            }}
                        >
                            {/* <input
                                type="checkbox"
                                checked={props.srcNetwork?.split(',').map(v => v.trim()).includes(networkId)}
                                onChange={() => props.srcNetworkChanged(network.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer px-2 mr-1"
                            /> */}
                            <NetworkIcon className="mr-2" alt="" src={network.logo} size={16} />
                            {helper.networkDisplayName(network.name)}
                            {props.srcNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="hidden dark:block w-4 h-4 ml-auto pl-2 box-content shrink-0"><path fillRule="evenodd" clipRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" /></svg> : null}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Destination" inline className="rounded-md" theme={chipTheme(props.destNetwork !== '')}>
                <div className="p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onKeyPress={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Filter networks..."
                        value={destFilter}
                        onChange={(e) => setDestFilter(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 text-sm bg-raised border border-line-strong rounded-md focus:outline-none focus:ring-2 focus:ring-focus text-fg"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <DropdownItem
                    className={`min-w-48 ${props.destNetwork === '' ? 'bg-hover' : ''}`}
                    onClick={() => {
                        props.destNetworkChanged('')
                    }}
                >
                    All Networks
                </DropdownItem>

                {filterNetworks(helper.getNetworks(), destFilter).map((network) => {
                    const networkId = helper.NETWORK_MAPPINGS[network.id]
                    return (
                        <DropdownItem
                            key={network.id}
                            className={`min-w-48 ${props.destNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? 'bg-menu-selected' : ''}`}
                            onClick={() => {
                                props.destNetworkChanged(network.id)
                            }}
                        >
                            {/* <input
                                type="checkbox"
                                checked={props.destNetwork?.split(',').map(v => v.trim()).includes(networkId)}
                                onChange={() => props.destNetworkChanged(network.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer px-2 mr-1"
                            /> */}
                            <NetworkIcon className="mr-2" alt="" src={network.logo} size={16} />
                            {helper.networkDisplayName(network.name)}
                            {props.destNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="hidden dark:block w-4 h-4 ml-auto pl-2 box-content shrink-0"><path fillRule="evenodd" clipRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" /></svg> : null}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Action" inline className="rounded-md " theme={chipTheme(props.actionType !== '')}>
                <DropdownItem
                    className={` min-w-48 ${props.actionType == '' ? 'bg-hover' : ''}`}
                    onClick={() => {
                        props.actionTypeChanged('')
                    }}
                >
                    All Actions
                </DropdownItem>

                {helper.getMsgTypes().map((actType) => {
                    return (
                        <DropdownItem
                            key={actType}
                            className={`min-w-48 ${props.actionType.includes(actType) ? 'bg-menu-selected' : ''}`}
                            onClick={() => {
                                props.actionTypeChanged(actType)
                            }}
                        >
                            {/* <input
                                type="checkbox"
                                checked={props.actionType?.includes(actType)}
                                onChange={() => props.actionTypeChanged(actType)}
                                onClick={(e) => e.stopPropagation()}
                                className="cursor-pointer px-2 mr-1"
                            /> */}
                            {actType}
                            {props.actionType.includes(actType) ? <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="hidden dark:block w-4 h-4 ml-auto pl-2 box-content shrink-0"><path fillRule="evenodd" clipRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 111.4-1.4l3.8 3.8 6.8-6.8a1 1 0 011.4 0z" /></svg> : null}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <button className={`rounded-full px-3 text-sm text-white underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-soda-bright ${props.compact ? 'h-9' : 'py-1.5'}`} onClick={() => props.resetClicked()}>
                Reset
            </button>
        </div>
    )
}

export default MessageFilter
