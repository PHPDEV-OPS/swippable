'use client'
import React from 'react'
import Link from 'next/link'

interface AuthLayoutProps {
    children: React.ReactNode
    title: string
    subtitle: string
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    return (
        <div className='min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden py-20 px-4'>
            {/* Background Orbs */}
            <div className='absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full' />
            <div className='absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/20 blur-[120px] rounded-full' />

            <div className='max-w-[500px] w-full z-10'>
                <div className='text-center mb-10'>
                    {/* Spacer to maintain layout positioning after logo removal */}
                    <div className='h-[112px] mb-8' />
                    <h1 className='text-3xl font-bold bg-clip-text text-transparent bg-linear-to-r from-white to-white/60 mb-3'>
                        {title}
                    </h1>
                    <p className='text-white/60 text-lg'>
                        {subtitle}
                    </p>
                </div>

                <div className='bg-white/[0.03] backdrop-blur-xl border border-white/10 p-8 sm:p-10 rounded-3xl shadow-2xl relative group'>
                    {/* Subtle border glow on hover */}
                    <div className='absolute inset-0 rounded-3xl bg-linear-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10' />

                    {children}
                </div>

                <div className='mt-8 text-center'>
                    <Link href="/" className='text-white/40 hover:text-primary transition-colors duration-300 flex items-center justify-center gap-2 text-sm'>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6" />
                        </svg>
                        Back to Home
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default AuthLayout
