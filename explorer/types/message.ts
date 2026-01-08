// Message status types
export type MessageStatus = 'pending' | 'executed' | 'delivered' | 'failed' | 'rollbacked'

// Message item type
export interface MessageItem {
    id: number
    sn: number
    status: MessageStatus
    src_network: string
    src_block_number?: number | null
    src_block_timestamp?: number | null
    src_tx_hash: string
    src_address?: string | null
    src_error?: string | null
    dest_network: string
    dest_block_number?: number | null
    dest_block_timestamp?: number | null
    dest_tx_hash?: string | null
    dest_address?: string | null
    dest_error?: string | null
    response_block_number?: number | null
    response_block_timestamp?: number | null
    response_tx_hash?: string | null
    response_error?: string | null
    rollback_block_number?: number | null
    rollback_block_timestamp?: number | null
    rollback_tx_hash?: string | null
    rollback_error?: string | null
    value?: string | null
    fee?: string | null
    action_type: string
    action_detail?: string | null
    action_amount_usd?: number | null
    created_at: number
    updated_at?: number | null
    slippage?: string | null
    intent_tx_hash?: string | null
}

// Message metadata (API response structure)
export interface MessageMeta {
    urls: {
        tx: Record<string, string>
    }
    pagination?: {
        total: number
        size: number
        number: number
    }
    time?: number
}

// API Response types
export interface MessagesResponse {
    data: MessageItem[]
    meta: MessageMeta
}

export interface MessageDetailResponse {
    data: MessageItem[]
    meta: {
        urls: {
            tx: Record<string, string>
        }
    }
}

export interface TotalMessagesResponse {
    data: {
        total: number
    }
}

// Component prop types
export interface MessageListProps {
    data?: MessageItem[]
    meta?: MessageMeta
    showPagination?: boolean
}

export interface MessageDetailProps {
    msgData: MessageItem
    meta: MessageMeta
}

export interface MessagePaginationProps {
    totalPages: number
    pageSize: number
    pageNumber: number
    pageSizeChanged: (value: number) => void
    pageNumberChanged: (value: number) => void
}
