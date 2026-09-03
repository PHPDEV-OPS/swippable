'use client'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { useState } from 'react'
import Loader from '@/components/Common/Loader'
import AuthLayout from '../AuthLayout'
import { Icon } from '@iconify/react'

const SignUp = () => {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    setLoading(true)
    const data = new FormData(e.currentTarget)
    const value = Object.fromEntries(data.entries())

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(value),
      })

      const data = await res.json()

      if (res.ok) {
        toast.success('Successfully registered')

        // Automatically sign in after registration
        const result = await signIn('credentials', {
          email: value.email as string,
          password: value.password as string,
          redirect: false,
        })

        if (result?.ok) {
          router.push('/dashboard')
          router.refresh()
        } else {
          router.push('/signin')
        }
        setLoading(false)
      } else {
        toast.error(data.error || 'Registration failed')
        setLoading(false)
      }
    } catch (err: any) {
      toast.error(err.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Create Account"
      subtitle="Join Swippable and start your journey"
    >
      <form onSubmit={handleSubmit} className='space-y-5'>
        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:user-linear" width="20" height="20" />
          </div>
          <input
            type='text'
            placeholder='Full Name'
            name='name'
            required
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
          />
        </div>

        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:letter-linear" width="20" height="20" />
          </div>
          <input
            type='email'
            placeholder='Email Address'
            name='email'
            required
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
          />
        </div>

        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:lock-password-linear" width="20" height="20" />
          </div>
          <input
            type='password'
            placeholder='Password'
            name='password'
            required
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
          />
        </div>

        <button
          type='submit'
          disabled={loading}
          className='bg-primary w-full py-4 mt-4 rounded-2xl text-background font-bold transition duration-300 hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100'>
          {loading ? <Loader /> : 'Sign Up'}
        </button>
      </form>

      <div className='mt-8 pt-6 border-t border-white/10'>
        <p className='text-xs text-white/40 text-center mb-6'>
          By creating an account you agree with our{' '}
          <Link href='#' className='text-primary hover:underline'>Privacy</Link>
          {' '}and{' '}
          <Link href='#' className='text-primary hover:underline'>Policy</Link>
        </p>

        <p className='text-white/60 text-sm text-center'>
          Already have an account?{' '}
          <Link href='/signin' className='text-primary font-bold hover:underline'>
            Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default SignUp

