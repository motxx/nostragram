import React, { useState } from 'react'
import { FaToggleOn, FaToggleOff } from 'react-icons/fa'
import NavigationSidebarItem from './NavigationSidebarItem'
import NavigationSidebarUserSection from './NavigationSidebarUserSection'
import { NavigationItem, NavigationItemId } from './Navigation'

interface NavigationSidebarProps {
  navigationItems: NavigationItem[]
  user: any
  onNavigate: (to: NavigationItemId) => void
}

const NavigationSidebar: React.FC<NavigationSidebarProps> = ({
  navigationItems,
  user,
  onNavigate,
}) => {
  const [isMining, setIsMining] = useState(false)

  const handleToggleMining = () => {
    setIsMining(!isMining)
  }

  return (
    <div className="bg-white dark:bg-black w-20 lg:w-60 h-full border-r border-gray-200 dark:border-gray-700 flex flex-col justify-between px-4 py-6 fixed font-mplus-2">
      <div className="space-y-2 lg:space-y-4">
        <a
          className="flex justify-center lg:justify-start items-center lg:space-x-2 p-2 font-playlist-script"
          href="/"
        >
          <div className="text-2xl font-bold text-black hidden lg:block dark:text-white">
            Nostragram
          </div>
          <div className="text-2xl font-bold text-black lg:hidden dark:text-white">
            Ng
          </div>
        </a>
        {navigationItems.map((item: NavigationItem, index: number) => (
          <NavigationSidebarItem
            key={index}
            icon={item.icon}
            id={item.id}
            label={item.label}
            onClick={() => onNavigate(item.id)}
          />
        ))}
        <div
          className="flex justify-center lg:justify-start items-center lg:space-x-2 p-2 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md transition cursor-pointer active:text-gray-400 dark:active:text-gray-400"
          onClick={handleToggleMining}
        >
          {isMining ? (
            <FaToggleOn className="text-xl text-green-500" />
          ) : (
            <FaToggleOff className="text-xl" />
          )}
          <span className="hidden lg:block">
            {isMining ? 'マイニング ON' : 'マイニング OFF'}
          </span>
        </div>
      </div>
      <NavigationSidebarUserSection user={user} />
    </div>
  )
}

export default NavigationSidebar