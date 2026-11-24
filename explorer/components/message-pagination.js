'use client'
import { PaginationBar } from './pagination'

// Callback-driven variant (home list): same bar as /messages, state lives in the page.
const MessagePagination = (props) => (
    <PaginationBar
        pageNumber={props.pageNumber}
        totalPages={props.totalPages}
        pageSize={props.pageSize}
        sizes={[10, 20, 50, 100, 200]}
        onPage={props.pageNumberChanged}
        onSize={props.pageSizeChanged}
    />
)

export default MessagePagination
