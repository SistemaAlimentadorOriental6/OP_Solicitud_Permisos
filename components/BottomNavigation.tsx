"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { Home, FileText, Briefcase, List, User, Monitor, BookOpen } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import useUserData from "@/app/hooks/useUserData"

interface BottomNavigationProps {
  hasNewNotification?: boolean
  showProfile?: boolean // Added showProfile prop
}

export default function BottomNavigation({ hasNewNotification = false, showProfile = false }: BottomNavigationProps) {
  const pathname = usePathname()
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const { userData } = useUserData()

  // Define base navigation items
  const baseNavItems: {
    icon: any
    label: string
    href: string
    badge?: boolean
  }[] = [
      {
        icon: Home,
        label: "Inicio",
        href: "/dashboard",
      },
      {
        icon: FileText,
        label: "Permisos",
        href: "/solicitud-permisos",
      },
      {
        icon: BookOpen,
        label: "Reglamento",
        href: "/reglamento",
      },
    ]

  // Solo mostrar Postulaciones para usuarios registrados (Operadores MySQL)
  if (userData?.userType === 'registered') {
    baseNavItems.push({
      icon: Monitor,
      label: "Postulaciones",
      href: "/solicitud-equipo",
    })
  }

  // Agregar siempre Solicitudes al final
  baseNavItems.push({
    icon: List,
    label: "Solicitudes",
    href: "/solicitudes-global",
    badge: hasNewNotification,
  })

  // Conditionally add profile item
  if (showProfile) {
    baseNavItems.push({
      icon: User,
      label: "Perfil",
      href: "/profile", // Assuming a profile page exists
    })
  }

  // Map to include active state
  const navItems = baseNavItems.map((item) => ({
    ...item,
    active: pathname === item.href,
  }))

  // Find active item index for mobile indicator
  const activeIndex = navItems.findIndex((item) => item.active)

  return (
    <>
      {/* Mobile Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white border-t border-gray-100 shadow-[0_-2px_15px_rgba(0,0,0,0.03)] py-3">
        <div className="relative flex justify-around items-center max-w-md mx-auto">
          {/* Navigation items */}
          <div className="flex justify-around items-center w-full">
            {navItems.map((item) => (
              <Link
                href={item.href}
                key={item.label}
                className="flex flex-col items-center justify-center relative flex-1"
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <motion.div
                  animate={{
                    scale: item.active ? 1.05 : 1,
                  }}
                  className={`relative mb-1 p-2 rounded-xl transition-all duration-300 ${item.active ? "bg-[#4cc253]/10 text-[#4cc253]" : "bg-transparent text-gray-400"
                    }`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.badge && (
                    <Badge className="absolute -top-1 -right-1 bg-red-500 text-white h-2 w-2 p-0 rounded-full flex items-center justify-center shadow-sm" />
                  )}
                </motion.div>
                <span
                  className={`text-[9px] font-black uppercase tracking-tighter transition-colors ${item.active ? "text-[#4cc253]" : "text-gray-400"
                    }`}
                >
                  {item.label}
                </span>
                {item.active && (
                  <motion.div
                    layoutId="mobileNavIndicator"
                    className="absolute -bottom-3 left-1/4 right-1/4 h-1 bg-[#4cc253] rounded-full"
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Navigation */}
      <div className="hidden md:block fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-2px_15px_rgba(0,0,0,0.03)] py-2 px-6 z-40">
        <div className="flex items-center justify-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-12">
            {navItems.map((item) => (
              <Link href={item.href} key={item.label} className="relative py-2 group">
                <div className="flex flex-col items-center space-y-1">
                  <motion.div
                    initial={false}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    animate={item.active ? { scale: 1.05 } : { scale: 1 }}
                    className={`p-2.5 rounded-2xl relative ${item.active
                      ? "bg-[#4cc253]/10 text-[#4cc253]"
                      : "bg-transparent group-hover:bg-gray-50 text-gray-400 group-hover:text-gray-600"
                      } transition-all duration-300`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.badge && (
                      <Badge className="absolute -top-1 -right-1 bg-red-500 text-white h-2 w-2 p-0 rounded-full flex items-center justify-center shadow-sm" />
                    )}
                  </motion.div>
                  <motion.span
                    animate={item.active ? { fontWeight: 900 } : { fontWeight: 700 }}
                    className={`text-[10px] uppercase tracking-widest ${item.active ? "text-[#4cc253]" : "text-gray-400 group-hover:text-gray-600"
                      }`}
                  >
                    {item.label}
                  </motion.span>
                </div>
                {item.active && (
                  <motion.div
                    layoutId="desktopNavIndicator"
                    className="absolute -bottom-2 left-0 right-0 h-1 bg-[#4cc253] rounded-full"
                    initial={false}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  />
                )}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
