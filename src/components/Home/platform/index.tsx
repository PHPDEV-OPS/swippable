import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const Platform = () => {
  return (
    <section className='py-16 sm:py-24' id='platform'>
      {/* Full-bleed violet, so the band reads as a break in the dark page. */}
      <div className='bg-[#8a6bd6] px-6 py-24 sm:px-10 sm:py-32'>
        <div className='container'>
          <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-white'>
            Ready when you are
          </p>

          <h2 className='mt-6 max-w-4xl text-5xl font-medium leading-[0.95] tracking-tight text-black sm:text-7xl lg:text-8xl'>
            Start spending.
          </h2>

          <p className='mt-8 max-w-md text-lg leading-relaxed text-black/80'>
            Open the dashboard, top up with M-Pesa, and issue your first virtual card before the
            kettle boils.
          </p>

          <div className='mt-10 flex flex-wrap items-center gap-4'>
            <Link
              href='/dashboard'
              className='group inline-flex items-center gap-2.5 rounded-full bg-black px-8 py-4 font-semibold text-white transition-transform hover:-translate-y-0.5'>
              Launch Dashboard
              <ArrowUpRight size={17} className='transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5' />
            </Link>
            <Link
              href='/sign-up'
              className='group inline-flex items-center gap-2.5 rounded-full border border-black/70 px-8 py-4 font-semibold text-black transition-colors hover:bg-black hover:text-white'>
              Create an account
              <ArrowUpRight size={17} className='transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5' />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Platform
