'use client'
import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Loader from '@/components/Common/Loader'
import { AuthLayout } from '../AuthLayout'
import { Icon } from '@iconify/react'

const ResetPassword = ({ token }: { token: string }) => {
  const [data, setData] = useState({
    newPassword: '',
    confirmPassword: '',
  })
  const [loader, setLoader] = useState(false)
  const [user, setUser] = useState({ email: '' })
  const router = useRouter()

  useEffect(() => {
    const verifyToken = async () => {
      try {
        const res = await axios.post(`/api/forgot-password/verify-token`, { token })
        if (res.status === 200) {
          setUser({ email: res.data.email })
        }
      } catch (error: any) {
        toast.error(error?.response?.data || 'Invalid or expired token')
        router.push('/forgot-password')
      }
    }
    verifyToken()
  }, [token, router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({
      ...data,
      [e.target.name]: e.target.value,
    })
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (data.newPassword !== data.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoader(true)
    try {
      const res = await axios.post(`/api/forgot-password/update`, {
        email: user?.email,
        password: data.newPassword,
      })

      if (res.status === 200) {
        toast.success(res.data)
        router.push('/signin')
      }
      setLoader(false)
    } catch (error: any) {
      toast.error(error?.response?.data || 'Failed to update password')
      setLoader(false)
    }
  }

  return (
    <AuthLayout mode="sign-in">
      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='relative group'>
          <div className='absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-primary transition-colors'>
            <Icon icon="solar:lock-password-linear" width="20" height="20" />
          </div>
          <input
            type='password'
            placeholder='New Password'
            name='newPassword'
            value={data.newPassword}
            onChange={handleChange}
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
            placeholder='Confirm New Password'
            name='confirmPassword'
            value={data.confirmPassword}
            onChange={handleChange}
            required
            className='w-full rounded-2xl border border-white/10 bg-white/5 pl-12 pr-5 py-4 text-base text-white outline-hidden transition focus:border-primary/50 focus:bg-white/10 placeholder:text-white/20'
          />
        </div>

        <button
          type='submit'
          disabled={loader}
          className='bg-primary w-full py-4 rounded-2xl text-background font-bold transition duration-300 hover:scale-[1.02] active:scale-[0.98] flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-50 disabled:hover:scale-100'>
          {loader ? <Loader /> : 'Reset Password'}
        </button>
      </form>
    </AuthLayout>
  )
}

export default ResetPassword

