'use client'
import Image from 'next/image'
import { timelineData } from '@/app/api/data'
import { motion } from 'framer-motion'

const TimeLine = () => {
  return (
    <section className='md:pt-40 pt-9' id='development'>
      <div className='container lg:px-16 px-4'>
        <div className='text-center'>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease: 'easeOut' }}>
            <div className='flex flex-col gap-4'>
              <p className='text-white font-medium'>
                How it <span className='text-primary'>works</span>
              </p>
              <h2 className='text-white sm:text-5xl text-3xl font-medium lg:w-4/5 mx-auto mb-20'>
                One wallet behind every card you issue
              </h2>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}>
            <div className='lg:block hidden relative'>
              <div>
                <Image
                  src='/images/timeline/img-timeline.png'
                  alt='image'
                  width={1220}
                  height={1000}
                  className='w-80% mx-auto'
                />
              </div>
              <div className='absolute lg:top-40 top-36 lg:left-0 -left-20 w-72 flex items-center gap-6'>
                <div className='text-right'>
                  <h3 className='text-muted text-2xl mb-3'>One shared balance</h3>
                  <p className='text-lg text-muted/60'>
                    Every card spends from the same wallet, so nothing sits stranded
                  </p>
                </div>
                <div className='bg-primary/15 backdrop-blur-xs p-6 h-fit rounded-full'>
                  <Image
                    src='/images/solution/solution-icon-1.svg'
                    alt='One shared balance'
                    width={44}
                    height={44}
                    className='w-16 h-16 '
                  />
                </div>
              </div>
              <div className='absolute lg:top-40 top-36 lg:right-0 -right-20 w-72 flex items-center gap-6'>
                <div className='bg-primary/15 backdrop-blur-xs p-6 h-fit rounded-full'>
                  <Image
                    src='/images/solution/solution-icon-2.svg'
                    alt='Instant virtual cards'
                    width={44}
                    height={44}
                  />
                </div>
                <div className='text-left'>
                  <h3 className='text-muted text-2xl mb-3'>Instant virtual cards</h3>
                  <p className='text-lg text-muted/60'>
                  Issue a card against your balance in seconds, limit included
                  </p>
                </div>
              </div>
              <div className='absolute lg:bottom-40 bottom-36 lg:left-0 -left-20 w-72 flex items-center gap-6'>
                <div className='text-right'>
                  <h3 className='text-muted text-2xl mb-3'>Real-time authorisation</h3>
                  <p className='text-lg text-muted/60'>
                  Every charge is checked against the limit and the balance first
                  </p>
                </div>
                <div className='bg-primary/15 backdrop-blur-xs p-6 h-fit rounded-full'>
                  <Image
                    src='/images/solution/solution-icon-3.svg'
                    alt='Real-time authorisation'
                    width={44}
                    height={44}
                    className='w-16 h-16 '
                  />
                </div>
              </div>
              <div className='absolute lg:bottom-40 bottom-36 lg:right-0 -right-20 w-72 flex items-center gap-6'>
                <div className='bg-primary/15 backdrop-blur-xs px-6 py-2 h-fit rounded-full'>
                  <Image
                    src='/images/solution/solution-icon-4.svg'
                    alt='Pause and release'
                    width={44}
                    height={44}
                    className='w-16 h-16'
                  />
                </div>
                <div className='text-left'>
                  <h3 className='text-muted text-nowrap text-2xl mb-3'>
                    Pause and release
                  </h3>
                  <p className='text-lg text-muted/60'>
                  Freeze a card, or release what it has not spent back to the wallet
                  </p>
                </div>
              </div>
            </div>
            <div className='grid sm:grid-cols-2 gap-8 lg:hidden'>
              {timelineData.map((item, index) => (
                <div key={index} className='flex items-center gap-6'>
                  <div className='bg-primary/15 p-6 rounded-full'>
                    <Image
                      src={item.icon}
                      alt={item.title}
                      width={44}
                      height={44}
                    />
                  </div>
                  <div className='text-start'>
                    <h4 className='text-2xl text-muted mb-2'>{item.title}</h4>
                    <p className='text-muted/60 text-lg'>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default TimeLine
