'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CreditCard, Activity, ArrowLeftRight, Settings, LogOut, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { useClerk } from '@clerk/nextjs';

const sidebarItems = [
    { icon: LayoutDashboard, label: 'Overview', href: '/dashboard' },
    { icon: CreditCard, label: 'Your Cards', href: '/dashboard/cards' },
    { icon: Activity, label: 'Analytics', href: '/dashboard/analytics' },
    { icon: ArrowLeftRight, label: 'Transactions', href: '/dashboard/transactions' },
    { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
];

export function Sidebar() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const { signOut } = useClerk();

    return (
        <>
            {/* Mobile Nav Toggle */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white rounded-xl shadow-lg shadow-purple-500/20"
            >
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {/* Sidebar Content */}
            <div className={cn(
                "fixed inset-y-0 left-0 z-40 w-64 bg-background border-r border-border transform transition-transform duration-300 lg:translate-x-0 lg:h-full lg:flex-shrink-0 lg:sticky lg:top-0",
                isOpen ? "translate-x-0" : "-translate-x-full"
            )}>
                <div className="h-full flex flex-col p-6">
                    <div className="flex items-center gap-3 px-2 mb-10">
                        <Image
                            src="/images/logo/logo.svg"
                            alt="logo"
                            width={32}
                            height={32}
                            className="w-8 h-8 [filter:hue-rotate(115deg)_saturate(1.2)]"
                        />
                        <span className="text-xl font-black bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent uppercase tracking-tighter">Swippable</span>
                    </div>

                    <nav className="flex-1 space-y-1.5">
                        {sidebarItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href;
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsOpen(false)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300",
                                        isActive
                                            ? "bg-gradient-to-r from-[#6330cf] to-[#8553ec] text-white font-bold shadow-lg shadow-purple-500/20"
                                            : "text-white/40 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <Icon size={20} />
                                    <span className="text-sm">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="pt-6 border-t border-white/5">
                        <button
                            onClick={() => {
                                setIsOpen(false);
                                signOut({ redirectUrl: '/' });
                            }}
                            className="flex items-center gap-3 px-4 py-3 w-full text-white/40 hover:text-red-400 hover:bg-red-400/5 rounded-2xl transition-all duration-300 font-bold text-sm"
                        >
                            <LogOut size={20} />
                            <span>Sign Out</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Backdrop for mobile */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </>
    );
}
