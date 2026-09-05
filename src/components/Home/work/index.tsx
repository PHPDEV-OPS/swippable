'use client'
import { motion } from 'framer-motion'
import { WalletShowcase } from '../showcase'

const services = [
  'One shared wallet balance',
  'Instant virtual card issuing',
  'M-Pesa and USDC top-ups',
  'Per-card spending limits',
]

const Work = () => {
  return (
    <section className='py-16 sm:py-20' id='work'>
      <div className='container mx-auto px-4 lg:max-w-(--breakpoint-xl)'>
        <div className='grid grid-cols-12 items-center gap-10'>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}
            className='col-span-12 lg:col-span-7'>
            <div className='flex flex-col gap-3'>
              <p className='font-medium text-white'>
                Why choose <span className='text-primary'>Swippable</span>
              </p>
              <h2 className='text-3xl font-medium text-white sm:text-5xl'>
                Everything your money does, in one place
              </h2>
              <p className='mt-2 max-w-xl text-lg text-white/60'>
                Fund the wallet once, then spend from it through as many virtual cards as you
                need. Every card draws on the same balance, so nothing sits stranded.
              </p>
            </div>

            <div className='mt-10 grid gap-6 md:grid-cols-2'>
              {services.map((service, index) => (
                <motion.div
                  key={service}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.08, ease: 'easeOut' }}
                  className='flex items-center gap-4'>
                  <span className='flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary'>
                    <svg viewBox='0 0 20 20' className='h-4 w-4' fill='none' aria-hidden>
                      <path
                        d='M4 10.5 8 14.5 16 6'
                        stroke='currentColor'
                        strokeWidth='2.2'
                        strokeLinecap='round'
                        strokeLinejoin='round'
                      />
                    </svg>
                  </span>
                  <p className='font-medium text-white'>{service}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.12, ease: 'easeOut' }}
            className='col-span-12 lg:col-span-5'>
            <WalletShowcase />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Work
