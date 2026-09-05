'use client'
import Image from 'next/image'
import { portfolioData } from '@/app/api/data'
import { motion } from 'framer-motion'
import { DashboardShowcase } from '../showcase'
import { LottieScene } from '../showcase/LottieScene'

const Portfolio = () => {
  return (
    <section className='pt-12' id='portfolio'>
      <div className='container px-4 sm:px-6'>
        <div className='grid lg:grid-cols-2 items-center gap-20'>
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}>
            {/* Motion scene for this section; falls back to the dashboard
                capture until the Lottie export is present. */}
            <LottieScene
              src='/animations/scene.json'
              ariaLabel='Swippable cards animating into a stack'
              className='mx-auto max-w-[620px]'
              fallback={<DashboardShowcase />}
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}>
            <div className='flex flex-col gap-4'>
              <p className='text-white font-medium'>
                Payment platform <span className='text-primary'>dashboard</span>
              </p>
              <h2 className='text-white sm:text-5xl text-3xl mb-4 font-medium'>
                Manage your payments and virtual cards securely
              </h2>
            </div>
            <p className='text-lg text-white/60'>
              Track every balance, card limit and transaction from one dashboard &mdash; each figure
              read straight from your ledger, never estimated.
            </p>

            <table className='w-full sm:w-[80%] mt-10'>
              <tbody>
                {portfolioData.map((item, index) => (
                  <tr key={index} className='border-b border-border'>
                    <td className='py-5'>
                      <div className='bg-primary/20 p-3 rounded-full w-fit'>
                        <Image
                          src={item.image}
                          alt={item.title}
                          width={24}
                          height={24}
                        />
                      </div>
                    </td>
                    <td className='py-5'>
                      <h3 className='text-muted text-xl ml-5'>
                        {item.title}
                      </h3>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Portfolio
