import Image from 'next/image'
import Link from 'next/link'

const Platform = () => {
  return (
    <section className='md:pt-44 sm:pt-24 pt-12 relative z-1'>
      <div className='container px-4'>
        <div className="bg-section/10 px-16 py-14 rounded-3xl border-2 border-white/10 grid grid-cols-12 items-center before:content-[''] before:absolute relative before:w-96 before:h-64 before:bg-start before:bg-no-repeat before:-bottom-6 overflow-hidden lg:before:right-0 before:-z-1 before:opacity-10 ">
          <div className='lg:col-span-8 col-span-12'>
            <h2 className='text-white sm:text-[40px] text-3xl mb-6'>
              Swippable: Secure Payments Platform
            </h2>
            <p className='text-muted/60 text-lg'>
              Our platform provides secure wallet management, virtual cards, and seamless payments for users across Africa.
            </p>
          </div>
          <div className='lg:col-span-4 col-span-12'>
            <div className='flex lg:justify-end lg:mt-0 mt-7 justify-center'>
              <Link
                href='/#work'
                className='flex items-center gap-2.5 text-white bg-gradient-to-r from-[#6330cf] to-[#8553ec] hover:opacity-95 border border-purple-500/30 py-3 px-5 rounded-lg sm:text-21 text-lg font-medium shadow-lg shadow-purple-500/20 transition-all'>
                Learn More
                <Image src={"/images/icons/icon-arrow.svg"} alt="icon" width={20} height={20} className='brightness-0 invert' />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default Platform
