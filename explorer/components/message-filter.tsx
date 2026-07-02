'use client'

import { useState } from 'react'
import { Dropdown, DropdownItem } from 'flowbite-react'
import helper from '@/lib/helper'
import Render from '@/lib/render'
import Image from 'next/image'

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
    srcNetworkChanged: (value: string) => void
    destNetworkChanged: (value: string) => void
    actionTypeChanged: (value: string) => void
    statusChanged: (value: string) => void
    resetClicked: () => void
}

const MessageFilter = (props: MessageFilterProps) => {
    const [srcFilter, setSrcFilter] = useState<string>('')
    const [destFilter, setDestFilter] = useState<string>('')

    const dropdownTheme = {
        inlineWrapper: 'flex items-center hover:text-cherry-brighter'
    }

    const filterNetworks = (networks: Network[], filterText: string): Network[] => {
        if (!filterText) return networks
        const lowerFilter = filterText.toLowerCase()
        return networks.filter(network => 
            network.name.toLowerCase().includes(lowerFilter)
        )
    }

    return (
        <div className="flex flex-row-reverse gap-4 text-white p-1 rounded-md">
            <button className="hover:text-cherry-brighter" onClick={() => props.resetClicked()}>
                Reset
            </button>

            <Dropdown label="Action" inline className="rounded-md " theme={dropdownTheme}>
                <DropdownItem
                    className={` min-w-48 ${props.actionType == '' ? 'bg-almost-white' : ''}`}
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
                            className={`min-w-48 ${props.actionType.includes(actType) ? 'bg-soda-clicked' : ''}`}
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

                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Destination" inline className="rounded-md" theme={dropdownTheme}>
                <div className="p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onKeyPress={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Filter networks..."
                        value={destFilter}
                        onChange={(e) => setDestFilter(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 text-sm border border-clay-light rounded-md focus:outline-none focus:ring-2 focus:ring-cherry text-espresso"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <DropdownItem
                    className={`min-w-48 ${props.destNetwork === '' ? 'bg-almost-white' : ''}`}
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
                            className={`min-w-48 ${props.destNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? 'bg-soda-clicked' : ''}`}
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
                            <Image className="relative inline-block mr-2 rounded-full bg-transparent" alt={network.name} src={network.logo} width={16} height={16} />
                            {network.name}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Source" inline className="rounded-md" theme={dropdownTheme}>
                <div className="p-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onKeyPress={(e) => e.stopPropagation()}>
                    <input
                        type="text"
                        placeholder="Filter networks..."
                        value={srcFilter}
                        onChange={(e) => setSrcFilter(e.target.value)}
                        onKeyDown={(e) => e.stopPropagation()}
                        onKeyPress={(e) => e.stopPropagation()}
                        onKeyUp={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 text-sm border border-clay-light rounded-md focus:outline-none focus:ring-2 focus:ring-cherry text-espresso"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
                <DropdownItem
                    className={`min-w-48 ${props.srcNetwork === '' ? 'bg-almost-white' : ''}`}
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
                            className={`min-w-48 ${props.srcNetwork?.split(',').map(v => v.trim()).includes(String(networkId)) ? 'bg-soda-clicked' : ''}`}
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
                            <Image className="relative inline-block mr-2 rounded-full bg-transparent" alt={network.name} src={network.logo} width={16} height={16} />
                            {network.name}
                        </DropdownItem>
                    )
                })}
            </Dropdown>

            <Dropdown label="Status" inline className="rounded-md" theme={dropdownTheme}>
                <DropdownItem
                    className={`min-w-32 ${props.status == '' ? 'bg-almost-white' : ''}`}
                    onClick={() => {
                        props.statusChanged('')
                    }}
                >
                    All Status
                </DropdownItem>

                {['Pending', 'Delivered', 'Executed', 'Rollbacked', 'Failed'].map((status) => {
                    return (
                        <DropdownItem
                            key={status}
                            className={`${props.status == status ? 'bg-almost-white' : ''}`}
                            onClick={() => {
                                props.statusChanged(status)
                            }}
                        >
                            {Render.renderMessageStatus(status)}
                        </DropdownItem>
                    )
                })}
            </Dropdown>
        </div>
    )
}

export default MessageFilter
