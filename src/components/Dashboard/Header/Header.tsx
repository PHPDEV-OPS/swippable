'use client';

import { Bell, Moon, Search, Sun, User, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export function DashboardHeader() {
    const { theme, setTheme } = useTheme();
    const { data: session } = useSession();
    const router = useRouter();

    const handleLogout = () => {
        signOut({ callbackUrl: '/' });
    };

    return (
        <header className="h-16 px-6 border-b border-border bg-background flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-4 flex-1">
                <h1 className="text-xl font-semibold hidden md:block">Dashboard</h1>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search..."
                        className="pl-9 pr-4 py-2 bg-white/5 border border-white/10 focus:border-primary rounded-full text-sm outline-none w-64 transition-all"
                    />
                </div>

                <button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>

                <button className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary relative">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full" />
                </button>

                <button
                    onClick={handleLogout}
                    className="p-2 hover:bg-primary/10 rounded-full transition-colors text-muted-foreground hover:text-primary"
                    title="Logout"
                >
                    <LogOut size={20} />
                </button>

                <div className="flex items-center gap-3 pl-4 border-l border-border">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{session?.user?.name || 'User'}</p>
                        <p className="text-xs text-muted-foreground">Premium Plan</p>
                    </div>
                    <div className="h-9 w-9 bg-primary/20 rounded-full flex items-center justify-center text-primary font-medium overflow-hidden">
                        {session?.user?.image ? (
                            <Image src={session.user.image} alt="User" width={36} height={36} />
                        ) : (
                            <User size={20} />
                        )}
                    </div>
                </div>
            </div>
        </header >
    );
}
