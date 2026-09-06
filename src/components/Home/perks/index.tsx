import { ConnectionMap, type MapArc, type MapCity } from '../map/ConnectionMap'

/**
 * Coverage map.
 *
 * Only Nairobi is marked live, because M-Pesa is the rail that is actually
 * wired up today. The others are labelled as planned rather than implied to be
 * running - update `status` as each corridor opens.
 */
const cities: MapCity[] = [
  { id: 'nairobi', name: 'Nairobi', lon: 36.8219, lat: -1.2921, status: 'live', label: { dx: 1.4 } },
  { id: 'lagos', name: 'Lagos', lon: 3.3792, lat: 6.5244, status: 'planned', label: { dx: 1.4, dy: -3 } },
  { id: 'accra', name: 'Accra', lon: -0.187, lat: 5.6037, status: 'planned', label: { dx: -1.4, align: 'right' } },
  { id: 'london', name: 'London', lon: -0.1276, lat: 51.5072, status: 'planned', label: { dx: 1.4, dy: -4 } },
  { id: 'newyork', name: 'New York', lon: -74.006, lat: 40.7128, status: 'planned', label: { dx: -1.4, align: 'right' } },
]

const arcs: MapArc[] = [
  { from: 'nairobi', to: 'london', delay: 0 },
  { from: 'lagos', to: 'newyork', delay: 1.1 },
  { from: 'accra', to: 'london', delay: 2.2 },
]

const Perks = () => {
  return (
    <section className='relative pb-28' id='coverage'>
      <div className='container relative z-2 px-4'>
        <div className='text-center'>
          <div className='flex flex-col gap-4'>
            <p className='relative text-base text-white/70'>
              Always by <span className='text-primary'>your side</span>
            </p>
            <h2 className='text-3xl font-medium text-white sm:text-5xl'>
              Built for how money actually moves
            </h2>
            <p className='mx-auto max-w-xl text-white/60'>
              Top up locally, spend globally. Your wallet settles on the rails that already reach
              you, and every card draws on the same balance wherever it is used.
            </p>
          </div>

          <div className='mt-14 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0716]/60 p-4 sm:p-6'>
            <ConnectionMap cities={cities} arcs={arcs} />
          </div>

          <div className='mt-6 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-xs font-medium'>
            <span className='flex items-center gap-2 text-white/80'>
              <span className='h-2 w-2 rounded-full bg-[#EDE4FF] shadow-[0_0_0_4px_rgba(138,99,210,0.25)]' />
              Live today
            </span>
            <span className='flex items-center gap-2 text-white/50'>
              <span className='h-2 w-2 rounded-full bg-[#9B7BE0]' />
              On the roadmap
            </span>
          </div>
        </div>
      </div>

      <div className='absolute bottom-0 z-0 h-96 w-96 rounded-full bg-linear-to-br from-tealGreen to-charcoalGray opacity-60 blur-400 sm:-bottom-80 sm:-left-48 sm:h-50 sm:w-50'></div>
    </section>
  )
}

export default Perks
