"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useRouter } from "next/navigation"
import { useRBACContext } from "@/components/RBACProvider"
import {
  FileText,
  AlertTriangle,
  Database,
  Users,
  LogOut,
  ChevronRight,
  Menu,
  Bell,
  Search,
  LayoutDashboard,
  Shield,
  Activity
} from "lucide-react"
import PermitsManagement from "./permits-management"
import AdminUsersModal from "@/components/AdminUsersModal.tsx/page"
import RequestDashboard from "@/components/history-dashboard/requests-dashbord"
import PermitRequestForm from "@/app/dashboard-admin-requests/solicitud-permisos/page"
import { cn } from "@/lib/utils"

export default function AdminDashboard() {
  type SectionType = "permits" | "extemporaneous" | "history" | "users" | "exit"

  const router = useRouter()
  const [activeSection, setActiveSection] = useState<SectionType>("permits")
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [currentTime, setCurrentTime] = useState("")
  const [notifications] = useState(3)
  const {
    userContext,
    isLoading,
    isAuthenticated,
    hasCapability,
    displayName,
    logout
  } = useRBACContext()

  useEffect(() => {
    // Check authentication through RBAC context
    if (!isAuthenticated && !isLoading) {
      router.push("/")
      return
    }

    // Update time every minute
    const updateTime = () => {
      const now = new Date()
      setCurrentTime(now.toLocaleString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }))
    }

    updateTime()
    const interval = setInterval(updateTime, 60000)
    return () => clearInterval(interval)
  }, [])

  const navigationItems = [
    {
      id: "permits",
      title: "Gestión de Permisos",
      icon: FileText,
      description: "Administrar solicitudes",
    },
    {
      id: "extemporaneous",
      title: "Permisos Extemporáneos",
      icon: AlertTriangle,
      description: "Solicitudes urgentes",
    },
    {
      id: "history",
      title: "Registro Histórico",
      icon: Database,
      description: "Archivo completo",
    },
    {
      id: "users",
      title: "Gestión de Usuarios",
      icon: Users,
      description: "Administrar usuarios",
    }
  ]

  const handleSectionChange = (section: SectionType) => {
    if (section === "exit") {
      handleLogout()
    } else {
      setActiveSection(section)
      setSidebarOpen(false)
    }
  }

  const handleLogout = () => {
    localStorage.clear()
    logout()
    window.location.href = '/'
  }

  const getSectionTitle = () => {
    const section = navigationItems.find(s => s.id === activeSection)
    return section?.title || "Dashboard"
  }

  // Filter navigation based on RBAC permissions
  const filteredNavigation = navigationItems.filter(item => {
    switch (item.id) {
      case "permits":
        return hasCapability("canViewAllRequests") || hasCapability("canViewOwnRequests")
      case "extemporaneous":
        return hasCapability("canViewAllRequests") || hasCapability("canViewOwnRequests")
      case "history":
        return hasCapability("canViewAllRequests")
      case "users":
        return hasCapability("canViewAllUsers")
      default:
        return false
    }
  })

  return (
    <div className="flex h-screen bg-[#f8fafc] relative overflow-hidden font-sans">
      {/* Sidebar */}
      <motion.div
        initial={false}
        animate={{ x: sidebarOpen ? 0 : 0 }}
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white border-r border-gray-100 shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} transition-transform duration-500 ease-in-out lg:rounded-br-[3rem]`}
      >
        <div className="flex flex-col h-full bg-white lg:rounded-br-[3rem] overflow-hidden">
          {/* Sidebar Header */}
          <div className="p-10 pb-6">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-12 w-12 bg-[#4cc253] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[#4cc253]/20 relative overflow-hidden group">
                <Shield className="h-6 w-6 relative z-10 transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900 tracking-tighter leading-none">SAO6</h1>
                <p className="text-[10px] uppercase font-black text-[#4cc253] tracking-[0.2em] mt-1">Gestión Central</p>
              </div>
            </div>
          </div>

          {/* User Info Card */}
          <div className="px-6 py-2">
            <div className="bg-gray-50/50 rounded-[2rem] p-5 border border-gray-100/50 group hover:border-[#4cc253]/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center text-[#4cc253] font-black shadow-sm group-hover:scale-105 transition-transform">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'A'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-[#4cc253] uppercase tracking-widest mb-1">{displayName || 'Usuario'}</p>
                  <p className="text-sm font-black text-gray-900 truncate tracking-tight">Administrador de Sistema</p>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
            <p className="px-6 text-[10px] font-black text-gray-300 uppercase tracking-[0.3em] mb-6">Navegación</p>

            {filteredNavigation.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSectionChange(item.id as SectionType)}
                  className={cn(
                    "w-full flex items-center gap-4 px-6 py-4 rounded-[2rem] transition-all duration-500 group relative overflow-hidden",
                    isActive
                      ? "bg-[#4cc253] text-white shadow-2xl shadow-[#4cc253]/30"
                      : "text-gray-400 hover:bg-gray-50 hover:text-[#4cc253]"
                  )}
                >
                  <item.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", isActive ? "text-white" : "text-gray-400 group-hover:text-[#4cc253]")} />
                  <div className="text-left">
                    <p className={cn("text-[10px] font-black uppercase tracking-[0.15em]", isActive ? "text-white" : "text-gray-500 group-hover:text-[#4cc253]")}>
                      {item.title}
                    </p>
                  </div>
                  {isActive && (
                    <motion.div
                      layoutId="activeIndicator"
                      className="absolute right-6 h-1 w-1 rounded-full bg-white shadow-[0_0_8px_white]"
                    />
                  )}
                </button>
              )
            })}
          </nav>

          {/* Footer Actions */}
          <div className="p-6 border-t border-gray-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-4 px-6 py-4 rounded-[2rem] text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all duration-300 group"
            >
              <LogOut className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Finalizar Sesión</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full relative z-0 overflow-hidden bg-[#f8fafc]">
        {/* Background Decorations */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#4cc253]/5 rounded-full blur-[120px] -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 rounded-full blur-[100px] -ml-32 -mb-32 pointer-events-none" />

        {/* Header */}
        <header className="h-24 bg-white/70 backdrop-blur-xl border-b border-gray-100/50 flex items-center justify-between pl-8 pr-12 z-20 sticky top-0">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-3 rounded-2xl hover:bg-gray-50 text-gray-500 transition-all active:scale-95"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-[#4cc253] rounded-full" />
                <h2 className="text-2xl font-black text-gray-900 tracking-tighter uppercase leading-none">{getSectionTitle()}</h2>
              </div>
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mt-2 ml-4">Panel de Control SAO6</p>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-8 relative">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="h-full max-w-[1600px] mx-auto"
          >
            {activeSection === "permits" && <PermitsManagement />}
            {activeSection === "extemporaneous" && <PermitRequestForm isExtemporaneous={true} />}
            {activeSection === "history" && <RequestDashboard />}
            {activeSection === "users" && <AdminUsersModal />}
          </motion.div>
        </main>
      </div>

      {/* Overlay for Mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-md z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}