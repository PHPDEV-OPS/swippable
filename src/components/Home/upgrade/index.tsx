'use client'
import { upgradeData } from '@/app/api/data'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { CardLimitsIllustration } from '../illustrations'

const Upgrade = () => {
  return (
    <section className='py-20' id='upgrade'>
      <div className='container px-4'>
        <div className='grid items-center gap-10 lg:grid-cols-2'>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}>
            <p className='font-medium text-white'>
              Swippable <span className='text-primary'>platform</span>
            </p>
            <h2 className='mb-5 text-3xl font-medium text-white sm:text-5xl'>
              Control every card, from one balance
            </h2>
            <p className='mb-7 text-lg text-white/60'>
              Give each card its own limit, pause it in a tap, and release what it has not spent
              back to your wallet. No capital sits idle.
            </p>

            <div className='grid gap-5 sm:grid-cols-2'>
              {upgradeData.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.07, ease: 'easeOut' }}
                  className='flex items-start gap-3'>
                  <span className='mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary'>
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <h3 className='text-lg text-white/70'>{item.title}</h3>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}>
            <CardLimitsIllustration className='mx-auto h-auto w-full max-w-[540px]' />
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Upgrade
