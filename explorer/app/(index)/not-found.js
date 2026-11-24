export default function NotFound() {
    return (
        <div role="status" className="py-24 text-center">
            <p className="text-base font-medium text-fg">Page not found</p>
            <p className="mt-1 text-sm text-fg-muted">
                Go back to{' '}
                <a className="underline underline-offset-2 hover:text-fg" href="/">
                    all messages
                </a>
                .
            </p>
        </div>
    )
}
