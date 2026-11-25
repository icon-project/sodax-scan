// House ad for the SODAX API, ported from the sodax.com asset directory
// (sodax-frontend apps/web/app/partners/asset-directory/page.tsx, PartnerGuideBanner).
// Differences from the original: theme tokens instead of fixed colours so it works
// in dark mode, and a cherry-soda button (white text 4.9:1) instead of cherry-bright
// (2.4:1, below WCAG AA).
const PORTAL_URL =
    'https://portal.sodax.com/?utm_source=sodaxscan.com&utm_medium=referral&utm_campaign=api_key&utm_content=footer_banner'

export default function ApiBanner() {
    return (
        <section aria-label="SODAX API" className="px-4 xl:px-24 2xl:px-48 mb-10 xl:mb-14">
            <a
                href={PORTAL_URL}
                target="_blank"
                rel="noopener"
                data-cta-location="sodaxscan_footer_banner"
                className="group max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-8 bg-subtle rounded-large px-6 sm:px-10 py-6 transition-transform duration-200 ease-out hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* Phone: icon on its own line so icon, heading and text share one left edge. */}
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/sodax_logo.svg" alt="" width={24} height={24} className="w-6 h-6 shrink-0 object-contain" />
                        <h2 className="m-0 text-[18px] leading-[1.2] font-bold text-fg">Level up your project</h2>
                    </div>
                    <p className="m-0 text-[14px] leading-[1.4] text-fg-muted text-pretty">Ship cross-network features with the SODAX API</p>
                </div>
                <span className="inline-flex w-full sm:w-auto justify-center items-center gap-1 h-11 sm:h-10 px-6 rounded-full bg-cherry-soda text-white text-[14px] font-medium whitespace-nowrap transition-colors duration-150 group-hover:bg-cherry-dark">
                    Get your free API key
                    <svg
                        aria-hidden="true"
                        focusable="false"
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
                    >
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                    </svg>
                    <span className="sr-only">(opens in a new tab)</span>
                </span>
            </a>
        </section>
    )
}
