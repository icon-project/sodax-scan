import React from 'react'
export default function Link({ children, ...props }) {
    return <a {...props}>{children}</a>
}
