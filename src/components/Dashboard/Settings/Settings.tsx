'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import toast from 'react-hot-toast'

export function Settings() {
    const { user } = useUser()
    const [activeTab, setActiveTab] = useState('Profile')
    const [kycStatus, setKycStatus] = useState('PENDING')
    const [loadingKyc, setLoadingKyc] = useState(false)

    useEffect(() => {
        const fetchKycStatus = async () => {
            try {
                const res = await fetch('/api/kyc')
                if (res.ok) {
                    const data = await res.json()
                    setKycStatus(data.kyc_status)
                }
            } catch (error) {
                console.error('Error fetching KYC status:', error)
            }
        }
        fetchKycStatus()
    }, [])

    const handleVerifyEmail = async () => {
        setLoadingKyc(true)
        try {
            const res = await fetch('/api/kyc', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify_email' })
            })
            if (res.ok) {
                const data = await res.json()
                setKycStatus(data.status)
                toast.success('Email verified successfully!')
            }
        } catch (error) {
            console.error('Error verifying email:', error)
            toast.error('Failed to verify email')
        } finally {
            setLoadingKyc(false)
        }
    }

    const tabs = [
        { name: 'Profile', icon: 'solar:user-circle-linear' },
        { name: 'Security', icon: 'solar:shield-check-linear' },
        { name: 'Notifications', icon: 'solar:bell-linear' },
        { name: 'Connected Apps', icon: 'solar:link-linear' },
        { name: 'Billing', icon: 'solar:wallet-linear' },
    ]

    return (
        <div className='flex flex-col gap-8 pb-12'>
            <div>
                <h1 className='text-2xl sm:text-3xl font-extrabold text-[#1c1c24] dark:text-white tracking-tight mb-1'>
                    Account Settings
                </h1>
                <p className='text-[#777984] dark:text-[#888a93] text-sm'>
                    Manage your Swippable account preferences, verified identities, and security settings
                </p>
            </div>

            <div className='flex flex-col lg:flex-row gap-8'>
                {/* Sidebar Navigation */}
                <div className='lg:w-64 flex-shrink-0'>
                    <div className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[24px] p-3 space-y-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'>
                        {tabs.map((tab) => (
                            <button
                                key={tab.name}
                                type='button'
                                onClick={() => setActiveTab(tab.name)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-bold text-xs ${
                                    activeTab === tab.name
                                        ? 'bg-[#19191b] text-white dark:bg-white dark:text-black shadow-sm'
                                        : 'text-[#777984] hover:text-[#1c1c24] dark:text-[#888a93] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                                }`}
                            >
                                <Icon icon={tab.icon} width='18' height='18' />
                                {tab.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content Area */}
                <div className='flex-1'>
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className='bg-white dark:bg-[#121214] border border-black/[0.05] dark:border-white/[0.08] rounded-[28px] p-6 sm:p-8 space-y-8 shadow-[0_4px_24px_rgba(0,0,0,0.02)]'
                    >
                        {activeTab === 'Profile' && (
                            <>
                                <div className='flex flex-col sm:flex-row items-center gap-6 pb-8 border-b border-black/[0.05] dark:border-white/[0.08]'>
                                    <div className='relative group'>
                                        <div className='w-24 h-24 rounded-full border-4 border-[#f5f5f7] dark:border-white/10 overflow-hidden ring-4 ring-[#7042f4]/20 shadow-md'>
                                            <img
                                                src={user?.imageUrl || 'https://i.pravatar.cc/300'}
                                                alt='profile'
                                                className='w-full h-full object-cover'
                                            />
                                        </div>
                                    </div>
                                    <div className='text-center sm:text-left'>
                                        <h3 className='text-xl font-bold text-[#1c1c24] dark:text-white mb-1'>
                                            {user?.fullName || 'SK Sumon Hossen'}
                                        </h3>
                                        <p className='text-[#777984] dark:text-[#888a93] text-xs font-semibold'>
                                            {user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                                        </p>
                                        <div className='mt-3 flex gap-2 justify-center sm:justify-start items-center'>
                                            {kycStatus === 'VERIFIED' ? (
                                                <span className='px-3 py-1 bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa] text-[10px] font-bold rounded-full'>
                                                    ✓ Verified Identity
                                                </span>
                                            ) : (
                                                <button
                                                    type='button'
                                                    onClick={handleVerifyEmail}
                                                    disabled={loadingKyc}
                                                    className='px-3 py-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-bold rounded-full hover:bg-amber-500/20 transition-colors'
                                                >
                                                    {loadingKyc ? 'Verifying...' : 'Verify Email'}
                                                </button>
                                            )}
                                            <span className='px-3 py-1 bg-[#f0eaff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff] text-[10px] font-bold rounded-full'>
                                                Platinum Cardholder
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                    <div className='space-y-1.5'>
                                        <label className='text-[#777984] dark:text-[#888a93] text-[10px] font-bold uppercase tracking-wider ml-1'>
                                            Full Name
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue={user?.fullName || 'SK Sumon Hossen'}
                                            className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-[#1c1c24] dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-[#777984] dark:text-[#888a93] text-[10px] font-bold uppercase tracking-wider ml-1'>
                                            Email Address
                                        </label>
                                        <input
                                            type="email"
                                            defaultValue={user?.primaryEmailAddress?.emailAddress || 'user@example.com'}
                                            className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-[#1c1c24] dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-[#777984] dark:text-[#888a93] text-[10px] font-bold uppercase tracking-wider ml-1'>
                                            Phone Number
                                        </label>
                                        <input
                                            type="text"
                                            defaultValue="+1 (555) 234-5678"
                                            className='w-full bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-[#1c1c24] dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'
                                        />
                                    </div>
                                    <div className='space-y-1.5'>
                                        <label className='text-[#777984] dark:text-[#888a93] text-[10px] font-bold uppercase tracking-wider ml-1'>
                                            Currency / Region
                                        </label>
                                        <select className='w-full bg-[#f5f5f7] dark:bg-[#18181b] border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-[#1c1c24] dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-[#7042f4]'>
                                            <option>USD ($) - United States</option>
                                            <option>GBP (£) - United Kingdom</option>
                                            <option>EUR (€) - European Union</option>
                                            <option>KES (KSh) - Kenya</option>
                                        </select>
                                    </div>
                                </div>

                                <div className='pt-6 border-t border-black/[0.05] dark:border-white/[0.08] flex justify-end gap-3'>
                                    <button
                                        type='button'
                                        className='px-6 py-2.5 rounded-xl text-[#777984] font-bold text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors'
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => toast.success('Profile preferences updated')}
                                        className='px-7 py-2.5 bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white rounded-xl font-bold text-xs shadow-md hover:opacity-95 transition-all'
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </>
                        )}

                        {activeTab === 'Security' && (
                            <div className='space-y-6'>
                                <div className='flex items-center justify-between p-5 bg-[#fafafc] dark:bg-white/[0.03] rounded-2xl border border-black/[0.04] dark:border-white/[0.05]'>
                                    <div className='flex items-center gap-3.5'>
                                        <div className='w-11 h-11 bg-[#e7faf4] text-[#12b88f] dark:bg-[#0b3c32] dark:text-[#28d6aa] rounded-xl flex items-center justify-center shadow-sm'>
                                            <Icon icon='solar:lock-password-linear' width='22' height='22' />
                                        </div>
                                        <div>
                                            <h4 className='text-sm font-bold text-[#1c1c24] dark:text-white'>Two-Factor Authentication</h4>
                                            <p className='text-xs text-[#777984] dark:text-[#888a93]'>Biometrics & TOTP authenticator protection</p>
                                        </div>
                                    </div>
                                    <button
                                        type='button'
                                        onClick={() => toast.success('2FA is active')}
                                        className='px-4 py-2 bg-[#19191b] text-white dark:bg-white dark:text-black rounded-xl font-bold text-xs shadow-sm hover:opacity-90 transition-all'
                                    >
                                        Enabled
                                    </button>
                                </div>

                                <div className='space-y-4'>
                                    <h4 className='text-[#777984] dark:text-[#888a93] text-xs font-bold uppercase tracking-wider ml-1'>
                                        Credentials & Sessions
                                    </h4>
                                    <div className='grid gap-3'>
                                        <button
                                            type='button'
                                            onClick={() => toast.success('Password update link sent to email')}
                                            className='w-full flex items-center justify-between p-4 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.04] hover:bg-[#eceef2] dark:hover:bg-white/[0.07] transition-all'
                                        >
                                            <span className='text-xs font-bold text-[#1c1c24] dark:text-white'>Update Security Password</span>
                                            <Icon icon='solar:alt-arrow-right-linear' className='text-[#9a9ca4]' />
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() => toast.success('All other devices signed out')}
                                            className='w-full flex items-center justify-between p-4 rounded-xl bg-[#f5f5f7] dark:bg-white/[0.04] hover:bg-[#eceef2] dark:hover:bg-white/[0.07] transition-all'
                                        >
                                            <span className='text-xs font-bold text-[#1c1c24] dark:text-white'>Revoke Other Sessions</span>
                                            <Icon icon='solar:alt-arrow-right-linear' className='text-[#9a9ca4]' />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Billing' && (
                            <WalletSettings />
                        )}

                        {(activeTab !== 'Profile' && activeTab !== 'Security' && activeTab !== 'Billing') && (
                            <div className='py-16 flex flex-col items-center justify-center text-center space-y-3'>
                                <div className='w-16 h-16 bg-[#f0eaff] text-[#6330cf] dark:bg-[#281b45] dark:text-[#c4a8ff] rounded-2xl flex items-center justify-center shadow-sm'>
                                    <Icon icon='solar:settings-bold-duotone' width='36' height='36' />
                                </div>
                                <h3 className='text-base font-bold text-[#1c1c24] dark:text-white'>{activeTab} Preferences</h3>
                                <p className='text-xs text-[#777984] dark:text-[#888a93] max-w-sm'>
                                    Configurable alert rules and integration settings are active.
                                </p>
                            </div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    )
}

function WalletSettings() {
    const [walletAddress, setWalletAddress] = useState('')
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        fetch('/api/wallet')
            .then(res => res.json())
            .then(data => {
                if (data && data.base_account_address) {
                    setWalletAddress(data.base_account_address)
                }
            })
            .catch(err => console.error(err))
            .finally(() => setLoading(false))
    }, [])

    const handleSave = async () => {
        setSaving(true)
        try {
            const res = await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ address: walletAddress })
            })
            if (res.ok) {
                toast.success('Wallet connected successfully!')
            } else {
                toast.error('Failed to connect wallet')
            }
        } catch {
            toast.error('Error connecting wallet')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className='space-y-6'>
            <div className='flex items-center justify-between p-5 bg-[#fafafc] dark:bg-white/[0.03] rounded-2xl border border-black/[0.04] dark:border-white/[0.05]'>
                <div className='flex items-center gap-3.5'>
                    <div className='w-11 h-11 bg-[#f0eaff] text-[#7042f4] dark:bg-[#281b45] dark:text-[#c4a8ff] rounded-xl flex items-center justify-center shadow-sm'>
                        <Icon icon='solar:wallet-linear' width='22' height='22' />
                    </div>
                    <div>
                        <h4 className='text-sm font-bold text-[#1c1c24] dark:text-white'>Base EVM Funding Account</h4>
                        <p className='text-xs text-[#777984] dark:text-[#888a93]'>Connect funding wallet to power your virtual card balances</p>
                    </div>
                </div>
            </div>

            <div className='space-y-3'>
                <label className='text-[#777984] dark:text-[#888a93] text-xs font-bold uppercase tracking-wider ml-1'>
                    Wallet Address (Base Network)
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                    <input 
                        type="text" 
                        value={walletAddress}
                        onChange={(e) => setWalletAddress(e.target.value)}
                        placeholder="0x..." 
                        className='flex-1 bg-[#f5f5f7] dark:bg-white/5 border border-black/[0.05] dark:border-white/[0.08] rounded-xl px-4 py-3 text-xs text-[#1c1c24] dark:text-white font-mono outline-none focus:ring-2 focus:ring-[#7042f4]' 
                    />
                    <button 
                        onClick={handleSave}
                        disabled={saving || loading}
                        className='px-6 py-3 bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white rounded-xl font-bold text-xs shadow-md hover:opacity-90 transition-all disabled:opacity-50'
                    >
                        {saving ? 'Saving...' : 'Connect'}
                    </button>
                </div>
            </div>
        </div>
    )
}
