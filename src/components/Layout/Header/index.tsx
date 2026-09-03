'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { headerData } from '../Header/Navigation/menuData'
import Logo from './Logo'
import Image from 'next/image'
import HeaderLink from '../Header/Navigation/HeaderLink'
import MobileHeaderLink from '../Header/Navigation/MobileHeaderLink'
import { useTheme } from 'next-themes'
import { Icon } from '@iconify/react/dist/iconify.js'
import { UserButton, useUser } from '@clerk/nextjs'

const Header: React.FC = () => {
  const pathUrl = usePathname()
  const { theme, setTheme } = useTheme()
  const { isLoaded, isSignedIn, user } = useUser()

  const [navbarOpen, setNavbarOpen] = useState(false)
  const [sticky, setSticky] = useState(false)

  const navbarRef = useRef<HTMLDivElement>(null)
  const mobileMenuRef = useRef<HTMLDivElement>(null)

  const handleScroll = () => {
    setSticky(window.scrollY >= 80)
  }

  const handleClickOutside = (event: MouseEvent) => {
    if (
      mobileMenuRef.current &&
      !mobileMenuRef.current.contains(event.target as Node) &&
      navbarOpen
    ) {
      setNavbarOpen(false)
    }
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [navbarOpen])

  useEffect(() => {
    if (navbarOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [navbarOpen])

  return (
    <header
      className={`fixed top-0 z-40 w-full pb-5 transition-all duration-300 ${sticky ? ' shadow-lg bg-background pt-5' : 'shadow-none pt-7'
        }`}>
      <div className='lg:py-0 py-2'>
        <div className='container px-4 flex items-center justify-between'>
          <Logo />
          <nav className='hidden lg:flex grow items-center gap-8 justify-center'>
            {headerData.map((item, index) => (
              <HeaderLink key={index} item={item} />
            ))}
          </nav>
          <div className='sm:flex hidden gap-4'>
            {!isLoaded ? (
              <div className='text-white'>Loading...</div>
            ) : isSignedIn ? (
              <div className='flex items-center gap-4'>
                <span className='text-white'>Welcome, {user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
                <UserButton />
              </div>
            ) : (
              <>
                <Link
                  href='/signin'
                  className='bg-transparent border border-primary text-primary px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white'
                >
                  Sign In
                </Link>
                <Link
                  href='/signup'
                  className='bg-primary text-white px-4 py-2 rounded-lg hover:bg-transparent hover:text-primary border border-primary'
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
          </div>
          <button
            onClick={() => setNavbarOpen(!navbarOpen)}
            className='block lg:hidden p-2 rounded-lg'
            aria-label='Toggle mobile menu'>
            <span className='block w-6 h-0.5 bg-white'></span>
            <span className='block w-6 h-0.5 bg-white mt-1.5'></span>
            <span className='block w-6 h-0.5 bg-white mt-1.5'></span>
          </button>
        </div>
        {navbarOpen && (
          <div className='fixed top-0 left-0 w-full h-full bg-black/50 z-40' />
        )}
        <div
          ref={mobileMenuRef}
          className={`lg:hidden fixed top-0 right-0 h-full w-full bg-background shadow-lg transform transition-transform duration-300 max-w-xs ${navbarOpen ? 'translate-x-0' : 'translate-x-full'
            } z-50`}>
          <div className='flex items-center justify-between p-4'>
            <h2 className='text-lg font-bold text-foreground dark:text-foreground'>
              <Logo />
            </h2>

            {/*  */}
            <button
              onClick={() => setNavbarOpen(false)}
              className="bg-[url('/images/closed.svg')] bg-no-repeat bg-contain w-5 h-5 absolute top-0 right-0 mr-8 mt-8 dark:invert"
              aria-label='Close menu Modal'></button>
          </div>
          <nav className='flex flex-col items-start p-4'>
            {headerData.map((item, index) => (
              <MobileHeaderLink key={index} item={item} />
            ))}
            <div className='mt-4 flex flex-col gap-4 w-full'>
              {!isLoaded ? (
                <div className='text-white text-center'>Loading...</div>
              ) : isSignedIn ? (
                <div className='flex flex-col gap-4'>
                  <span className='text-white text-center'>Welcome, {user?.fullName || user?.primaryEmailAddress?.emailAddress}</span>
                  <div className='flex justify-center'><UserButton /></div>
                </div>
              ) : (
                <>
                  <Link
                    href='/signin'
                    className='bg-transparent border border-primary text-primary px-4 py-2 rounded-lg hover:bg-blue-600 hover:text-white text-center'
                    onClick={() => setNavbarOpen(false)}
                  >
                    Sign In
                  </Link>
                  <Link
                    href='/signup'
                    className='bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-center'
                    onClick={() => setNavbarOpen(false)}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
    </header>
  )
}

export default Header
