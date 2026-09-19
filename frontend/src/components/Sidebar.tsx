import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboardIcon, UsersIcon, Wand2Icon, CalendarDaysIcon, LogOutIcon } from 'lucide-react'

const Sidebar = ({ isOpen, setIsOpen }: { isOpen: boolean; setIsOpen: (val: boolean) => void }) => {

  const { logout, user } = {
    logout: () => {
      window.location.href = '/';
    },
    user: { name: 'John Doe', email: 'johndoe@example.com' }
  }

  const location = useLocation()

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboardIcon, path: '/dashboard' },
    { name: 'Social Accounts', icon: UsersIcon, path: '/accounts' },
    { name: 'Scheduler', icon: CalendarDaysIcon, path: '/scheduler' },
    { name: 'AI Composer', icon: Wand2Icon, path: '/ai-composer' },
  ]

  return (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200
      flex flex-col h-full transform transition-transform duration-200 ease-in-out
      md:relative md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="p-6 pb-4">
        <div className="text-xl tracking-tight text-slate-800 flex items-center gap-1.5">
          <img src="/logo.svg" alt="Logo" className="size-6" />
          QueueUp
        </div>
      </div>

      {/* nav section label */}
      <div className="px-6 py-2">
        <span className="text-xs text-slate-500 uppercase tracking-wider">
          Menu
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          const ItemIcon = item.icon

          return (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/dashboard'}
              onClick={() => setIsOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded
              text-sm transition-all duration-150 border ${isActive
                  ? 'bg-red-100 text-red-700 border-red-200'
                  : 'text-slate-700 hover:bg-slate-100 border-transparent'
                }`}
            >
              <ItemIcon
                className={`size-4.5 shrink-0 ${isActive ? 'text-red-500' : 'text-slate-500'
                  }`}
              />
              {item.name}
              {isActive && (
                <span className="ml-auto w-[5px] h-5 rounded-full bg-red-500" />
              )}
            </NavLink>
          )
        })}
      </nav>

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
          <div className='size-8 rounded-full bg-linear-to-br from-red-400 to-pink-400
    flex items-center justify-center text-white text-sm font-medium shrink-0'>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-800 truncate">{user?.name || 'User'}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email || 'user@example.com'}</div>
          </div>
        </div>

        <button
          onClick={logout}
          className="flex items-center gap-2 px-3 py-2 mt-1 w-full rounded text-sm text-slate-500
     hover:bg-red-50 hover:text-red-500 transition-all duration-150"
        >
          <LogOutIcon className="size-4" />
          Sign Out
        </button>
      </div>
    </div>
  )
}

export default Sidebar