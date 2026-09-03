'use client'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import toast from 'react-hot-toast'
import Loader from '@/components/Common/Loader'
import AuthLayout from '../AuthLayout'
import { Icon } from '@iconify/react'

const Signin = () => {
  const router = useRouter()

  const [loginData, setLoginData] = useState({
    email: '',
    password: '',
  })
  const [loading, setLoading] = useState(false)

  const loginUser = async (e: any) => {
    e.preventDefault()

    if (!loginData.email || !loginData.password) {
      toast.error('Please enter email and password')
      return
    }

    setLoading(true)

    try {
      const result = await signIn('credentials', {
        ...loginData,
        redirect: false,
      })

      if (result?.error) {
        toast.error(result.error)
        setLoading(false)
      } else if (result?.ok) {
        toast.success('Login successful')
        router.push('/dashboard')
        router.refresh()
      } else {
        setLoading(false)
        toast.error('Login failed')
      }
    } catch (error) {
      setLoading(false)
      console.error(error)
      toast.error('Something went wrong')
    }
  }

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Enter your details to access your account"
    >
      <form onSubmit={loginUser} className='space-y-6'>
        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:letter-linear" width="20" height="20" />
          </div>
          <input
            type='email'
            placeholder='Email Address'
            value={loginData.email}
            onChange={(e) =>
              setLoginData({ ...loginData, email: e.target.value })
            }
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
            required
          />
        </div>

        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:lock-password-linear" width="20" height="20" />
          </div>
          <input
            type='password'
            placeholder='Password'
            value={loginData.password}
            onChange={(e) =>
              setLoginData({ ...loginData, password: e.target.value })
            }
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
            required
          />
        </div>

        <div className='flex justify-end'>
          <Link
            href='/forgot-password'
            className='text-sm text-white/40 hover:text-primary transition-colors'>
            Forgot Password?
          </Link>
        </div>

        <button
          type='submit'
          disabled={loading}
          className='bg-primary w-full py-4 rounded-2xl text-background font-bold transition duration-300 hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100'>
          {loading ? <Loader /> : 'Sign In'}
        </button>
      </form>

      <div className='mt-8 pt-8 border-t border-white/10 text-center'>
        <p className='text-white/60 text-sm'>
          Not a member yet?{' '}
          <Link href='/signup' className='text-primary font-bold hover:underline'>
            Create an Account
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default Signin
