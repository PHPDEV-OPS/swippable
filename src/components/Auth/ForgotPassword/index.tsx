'use client'
import React from 'react'
import { useState } from 'react'
import toast from 'react-hot-toast'
import axios from 'axios'
import Loader from '@/components/Common/Loader'
import Link from 'next/link'
import AuthLayout from '../AuthLayout'
import { Icon } from '@iconify/react'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [loader, setLoader] = useState(false)

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!email) {
      toast.error('Please enter your email address.')
      return
    }

    setLoader(true)

    try {
      const res = await axios.post('/api/forgot-password/reset', {
        email: email.toLowerCase(),
      })

      if (res.status === 200) {
        toast.success(res.data)
        setEmail('')
      }
      setLoader(false)
    } catch (error: any) {
      toast.error(error?.response?.data || 'Something went wrong')
      setLoader(false)
    }
  }

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your email to receive a password reset link"
    >
      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:letter-linear" width="20" height="20" />
          </div>
          <input
            type='email'
            placeholder='Email Address'
            name='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
          />
        </div>

        <button
          type='submit'
          disabled={loader}
          className='bg-primary w-full py-4 rounded-2xl text-background font-bold transition duration-300 hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100'>
          {loader ? <Loader /> : 'Send Reset Link'}
        </button>
      </form>

      <div className='mt-8 pt-6 border-t border-white/10 text-center'>
        <p className='text-white/60 text-sm'>
          Remembered your password?{' '}
          <Link href='/signin' className='text-primary font-bold hover:underline'>
            Back to Sign In
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}

export default ForgotPassword

