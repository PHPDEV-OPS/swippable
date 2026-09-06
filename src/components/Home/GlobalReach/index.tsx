import { GlobalReachData } from './data'

/**
 * Capability band.
 *
 * Deliberately factual rather than a volume scoreboard: these are things the
 * platform demonstrably does today. Swap in real traffic numbers here once
 * there are some worth quoting.
 */
const GlobalReach = () => {
    return (
        <section className='py-16 sm:py-20'>
            <div className='container px-4'>
                <div className='grid grid-cols-1 divide-y divide-white/10 border-y border-white/10 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 sm:[&>*:nth-child(-n+2)]:border-b sm:[&>*:nth-child(-n+2)]:border-white/10 lg:[&>*]:border-b-0'>
                    {GlobalReachData.map((item) => (
                        <div
                            key={item.id}
                            className='px-0 py-8 sm:px-7 lg:border-l lg:border-white/10 lg:first:border-l-0 lg:first:pl-0'>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45'>
                                {item.label}
                            </p>
                            <p className='mt-4 text-4xl font-medium tracking-tight text-primary sm:text-[42px]'>
                                {item.value}
                            </p>
                            <p className='mt-3 text-sm text-white/55'>{item.detail}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}

export default GlobalReach
