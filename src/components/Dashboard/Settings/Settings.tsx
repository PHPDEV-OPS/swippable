'use client'

import { Icon } from '@iconify/react'
import { motion } from 'framer-motion'
import React, { useState } from 'react'
import { useSession } from 'next-auth/react'

export function Settings() {
    const { data: session } = useSession()
    const [activeTab, setActiveTab] = useState('Profile')
    const [kycStatus, setKycStatus] = useState('PENDING')
    const [loadingKyc, setLoadingKyc] = useState(false)

    React.useEffect(() => {
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
                // toast.success('Email verified successfully!') // Assuming toast is available or add it
            }
        } catch (error) {
            console.error('Error verifying email:', error)
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
        <div className='flex flex-col gap-10 pb-10'>
            <div>
                <h1 className='text-3xl font-bold text-white mb-1'>Settings</h1>
                <p className='text-white/40 text-sm'>Manage your account preferences and security settings</p>
            </div>

            <div className='flex flex-col lg:flex-row gap-10'>
                {/* Sidebar Navigation */}
                <div className='lg:w-72 flex-shrink-0'>
                    <div className='bg-white/5 border border-white/10 rounded-3xl p-4 space-y-2'>
                        {tabs.map((tab) => (
                            <button
                                key={tab.name}
                                onClick={() => setActiveTab(tab.name)}
                                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all duration-300 font-bold text-sm ${activeTab === tab.name
                                        ? 'bg-primary text-background shadow-lg shadow-primary/20'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <Icon icon={tab.icon} width='20' height='20' />
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
                        className='bg-white/5 border border-white/10 rounded-[2.5rem] p-10 space-y-12'
                    >
                        {activeTab === 'Profile' && (
                            <>
                                <div className='flex flex-col sm:flex-row items-center gap-8 pb-12 border-b border-white/5'>
                                    <div className='relative group'>
                                        <div className='w-32 h-32 rounded-full border-4 border-white/10 overflow-hidden ring-4 ring-white/5'>
                                            <img src={session?.user?.image || 'https://i.pravatar.cc/300'} alt='profile' className='w-full h-full object-cover' />
                                        </div>
                                        <button className='absolute bottom-0 right-0 bg-primary text-background p-2.5 rounded-xl shadow-lg hover:scale-110 transition-transform'>
                                            <Icon icon='solar:camera-linear' width='20' height='20' />
                                        </button>
                                    </div>
                                    <div className='text-center sm:text-left'>
                                        <h3 className='text-2xl font-black text-white mb-1'>{session?.user?.name || 'Alexander Munoz'}</h3>
                                        <p className='text-white/40 text-sm font-bold'>{session?.user?.email || 'alexander@example.com'}</p>
                                        <div className='mt-4 flex gap-3 justify-center sm:justify-start items-center'>
                                            {kycStatus === 'VERIFIED' ? (
                                                <span className='px-3 py-1 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest rounded-full border border-primary/20'>Verified User</span>
                                            ) : (
                                                <button 
                                                    onClick={handleVerifyEmail}
                                                    disabled={loadingKyc}
                                                    className='px-3 py-1 bg-orange-500/10 text-orange-500 text-[10px] font-black uppercase tracking-widest rounded-full border border-orange-500/20 hover:bg-orange-500/20 transition-colors'
                                                >
                                                    {loadingKyc ? 'Verifying...' : 'Verify Email'}
                                                </button>
                                            )}
                                            <span className='px-3 py-1 bg-secondary/10 text-secondary text-[10px] font-black uppercase tracking-widest rounded-full border border-secondary/20'>Premium</span>
                                        </div>
                                    </div>
                                </div>

                                <div className='grid grid-cols-1 md:grid-cols-2 gap-8'>
                                    <div className='space-y-2'>
                                        <label className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Full Name</label>
                                        <input type="text" defaultValue={session?.user?.name || 'Alexander Munoz'} className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary transition-all' />
                                    </div>
                                    <div className='space-y-2'>
                                        <label className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Email Address</label>
                                        <input type="email" defaultValue={session?.user?.email || 'alexander@example.com'} className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary transition-all' />
                                    </div>
                                    <div className='space-y-2'>
                                        <label className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Phone Number</label>
                                        <input type="text" defaultValue="+254 701 234 567" className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary transition-all' />
                                    </div>
                                    <div className='space-y-2'>
                                        <label className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Country</label>
                                        <select className='w-full bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary transition-all appearance-none'>
                                            <option className='bg-[#0d0d0d]'>Kenya</option>
                                            <option className='bg-[#0d0d0d]'>United Kingdom</option>
                                            <option className='bg-[#0d0d0d]'>United States</option>
                                        </select>
                                    </div>
                                </div>

                                <div className='pt-8 border-t border-white/5 flex justify-end gap-4'>
                                    <button className='px-8 py-4 rounded-2xl text-white/40 font-bold hover:text-white transition-colors'>Cancel</button>
                                    <button className='px-10 py-4 bg-primary text-background rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all'>Save Changes</button>
                                </div>
                            </>
                        )}

                        {activeTab === 'Security' && (
                            <div className='space-y-8'>
                                <div className='flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5'>
                                    <div className='flex items-center gap-4'>
                                        <div className='w-12 h-12 bg-secondary/10 text-secondary rounded-2xl flex items-center justify-center'>
                                            <Icon icon='solar:lock-password-linear' width='24' height='24' />
                                        </div>
                                        <div>
                                            <h4 className='text-white font-bold'>Two-Factor Authentication</h4>
                                            <p className='text-white/20 text-xs mt-1'>Add an extra layer of security to your account</p>
                                        </div>
                                    </div>
                                    <button className='px-6 py-2 bg-secondary text-background rounded-xl font-black text-[10px] uppercase tracking-widest hover:opacity-90 transition-all'>Enable</button>
                                </div>

                                <div className='space-y-6'>
                                    <h4 className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Password & Auth</h4>
                                    <div className='grid gap-4'>
                                        <button className='w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all'>
                                            <span className='text-sm text-white font-bold'>Update Password</span>
                                            <Icon icon='solar:alt-arrow-right-linear' className='text-white/20' />
                                        </button>
                                        <button className='w-full flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all'>
                                            <span className='text-sm text-white font-bold'>Authorized Devices</span>
                                            <Icon icon='solar:alt-arrow-right-linear' className='text-white/20' />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Billing' && (
                            <WalletSettings />
                        )}

                        {(activeTab !== 'Profile' && activeTab !== 'Security' && activeTab !== 'Billing') && (
                            <div className='h-[400px] flex flex-col items-center justify-center text-center space-y-4'>
                                <div className='w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center text-white/10'>
                                    <Icon icon='solar:settings-bold-duotone' width='48' height='48' />
                                </div>
                                <div>
                                    <h3 className='text-xl font-bold text-white'>{activeTab} Settings</h3>
                                    <p className='text-white/20 text-sm max-w-xs mx-auto'>This section is under development and will be available soon.</p>
                                </div>
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

    React.useEffect(() => {
        fetch('/api/wallet')
            .then(res => res.json())
            .then(data => {
                if (data.base_account_address) {
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
                alert('Wallet connected successfully!')
            } else {
                alert('Failed to connect wallet')
            }
        } catch (error) {
            console.error(error)
            alert('Error connecting wallet')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className='space-y-8'>
            <div className='flex items-center justify-between p-6 bg-white/5 rounded-3xl border border-white/5'>
                <div className='flex items-center gap-4'>
                    <div className='w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center'>
                        <Icon icon='solar:wallet-linear' width='24' height='24' />
                    </div>
                    <div>
                        <h4 className='text-white font-bold'>Crypto Wallet</h4>
                        <p className='text-white/20 text-xs mt-1'>Connect your Base wallet to fund your card</p>
                    </div>
                </div>
            </div>

            <div className='space-y-6'>
                <div className='space-y-2'>
                    <label className='text-white/40 text-[10px] font-black uppercase tracking-widest ml-1'>Wallet Address (Base Network)</label>
                    <div className="flex gap-4">
                        <input 
                            type="text" 
                            value={walletAddress}
                            onChange={(e) => setWalletAddress(e.target.value)}
                            placeholder="0x..." 
                            className='flex-1 bg-white/5 border border-white/5 rounded-2xl px-5 py-4 text-white text-sm outline-none focus:border-primary transition-all font-mono' 
                        />
                        <button 
                            onClick={handleSave}
                            disabled={saving || loading}
                            className='px-8 bg-primary text-background rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:opacity-90 transition-all disabled:opacity-50'
                        >
                            {saving ? 'Saving...' : 'Connect'}
                        </button>
                    </div>
                    <p className="text-xs text-white/20 ml-1">
                        Enter your Base wallet address manually for this demo. In production, this would use a wallet connector.
                    </p>
                </div>
            </div>
        </div>
    )
}

