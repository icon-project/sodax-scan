// https://loading.io/css/
// Cherry spinner for white surfaces (the detail card). Under reduced motion it
// keeps a slow spin (globals.css) so loading is still conveyed.
export default function Spinner() {
    return (
        <div className="h-[12rem] w-full flex justify-center items-center flex-col text-cherry-soda gap-2">
            <div
                className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em]"
                role="status"
            ></div>
            <span className="text-espresso">Loading...</span>
        </div>
    )
}
