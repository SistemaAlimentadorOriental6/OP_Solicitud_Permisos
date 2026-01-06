"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import {
  CalendarDays,
  Tag,
  Clock,
  CheckCircle,
  XCircle,
  Hourglass,
  FileText,
  ClipboardList,
  Search,
  Download,
  RefreshCw,
  X,
  SlidersHorizontal,
  Calendar,
  RotateCcw,
  ChevronDown,
  Users,
  AlertCircle,
  WifiOff,
  Loader2,
  Filter
} from "lucide-react"
import UserAvatar from "../UserAvatar/page"
import RequestDetails from "../request-details"
import * as XLSX from "xlsx"

// --- Tipos ---

interface RequestData {
  id: string
  userName: string
  userCode: string
  userAvatar: string
  requestType: string
  requestDate: string
  requestedDates: string
  status: string
  days: number
  submittedTime: string
  requestedTime: string
  department: string
  priority: string
  reason: string
  description: string
  createdAt?: string
}

interface FilterOptions {
  statuses: string[]
  types: string[]
  priorities: string[]
}

interface Filters {
  status: string
  type: string
  priority: string
  dateFrom: string
  dateTo: string
  daysMin: string
  daysMax: string
  search: string
}

interface GlobalStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

// --- Hooks ---

const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(true)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    setIsOnline(navigator.onLine)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])
  return isOnline
}

// --- Main Component ---

export default function RequestDashboard() {
  // State
  const [searchTerm, setSearchTerm] = useState("")
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false)
  const [activeSource, setActiveSource] = useState('permisos') // Default to 'permisos'
  const [requests, setRequests] = useState<RequestData[]>([])
  const [allFilteredRequests, setAllFilteredRequests] = useState<RequestData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState<RequestData | null>(null)
  const [showRequestDetails, setShowRequestDetails] = useState(false)

  // User Context
  const [currentUser, setCurrentUser] = useState<{ userType?: string; code?: string } | null>(null)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRequests, setTotalRequests] = useState(0)
  const [limit] = useState(50)

  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
  })

  // Filter Options
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    statuses: ["Todos", "Pendiente", "Aprobado", "Rechazado"],
    types: ["Todos"],
    priorities: ["Todos", "Urgente", "Alta", "Media", "Baja"],
  })

  const [filters, setFilters] = useState<Filters>({
    status: "Todos",
    type: "Todos",
    priority: "Todos",
    dateFrom: "",
    dateTo: "",
    daysMin: "",
    daysMax: "",
    search: "",
  })

  const isOnline = useOnlineStatus()
  const lastRequestTime = useRef<number>(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const MIN_REQUEST_INTERVAL = 1000

  // --- Data Fetching ---

  const fetchCurrentUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) return

      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (response.ok) {
        const userData = await response.json()
        setCurrentUser(userData)
        localStorage.setItem('userData', JSON.stringify(userData))
      }
    } catch {
      // Silent fail
    }
  }, [])

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  const fetchFilterOptions = useCallback(async () => {
    if (!isOnline) return
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) return

      const response = await fetch(`/api/admin/filter-options`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data && typeof data === "object") {
          setFilterOptions({
            statuses: ["Todos", ...(Array.isArray(data.statuses) ? data.statuses : [])],
            types: ["Todos", ...(Array.isArray(data.types) ? data.types : [])],
            priorities: ["Todos", ...(Array.isArray(data.priorities) ? data.priorities : [])],
          })
        }
      }
    } catch {
      // Silent fail
    }
  }, [isOnline])

  const fetchRequests = useCallback(async (page = 1) => {
    // Cancel previous
    if (abortControllerRef.current) abortControllerRef.current.abort()
    abortControllerRef.current = new AbortController()

    try {
      setLoading(true)
      setError(null)

      if (!isOnline) throw new Error("Sin conexión a internet")

      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("Sesión expirada")

      // Rate limiting basic check
      const now = Date.now()
      if (now - lastRequestTime.current < MIN_REQUEST_INTERVAL) {
        await new Promise(r => setTimeout(r, MIN_REQUEST_INTERVAL - (now - lastRequestTime.current)))
      }
      lastRequestTime.current = Date.now()

      const hasActiveFilters =
        (filters.dateFrom && filters.dateFrom.trim()) ||
        (filters.dateTo && filters.dateTo.trim()) ||
        (filters.status && filters.status !== "Todos") ||
        (filters.type && filters.type !== "Todos") ||
        (filters.priority && filters.priority !== "Todos") ||
        (filters.search && filters.search.trim())

      const params = new URLSearchParams({
        page: hasActiveFilters ? "1" : page.toString(),
        limit: hasActiveFilters ? "-1" : Math.min(limit, 100).toString(),
        source: activeSource,
      })

      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom)
      if (filters.dateTo) params.append("dateTo", filters.dateTo)
      if (filters.status && filters.status !== "Todos") params.append("status", filters.status)
      if (filters.type && filters.type !== "Todos") params.append("type", filters.type)
      if (filters.priority && filters.priority !== "Todos") params.append("priority", filters.priority)
      if (filters.search) params.append("search", filters.search.substring(0, 100))

      if (currentUser?.userType) {
        params.append("userType", currentUser.userType)
      }

      const response = await fetch(`/api/admin/requests?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        if (response.status === 429) throw new Error("Muchas peticiones al servidor. Espera un momento.")
        throw new Error(`Error ${response.status}: ${response.statusText}`)
      }

      const response_data = await response.json()
      const data = Array.isArray(response_data.data) ? response_data.data : []

      const responsePage = Math.max(1, Math.floor(Number(response_data.page)) || 1)
      const responseTotal = Math.max(0, Math.floor(Number(response_data.total)) || 0)

      if (hasActiveFilters) {
        setCurrentPage(page)
        setTotalRequests(data.length)
        setTotalPages(Math.ceil(data.length / limit))
      } else {
        setCurrentPage(responsePage)
        setTotalPages(Math.ceil(responseTotal / limit)) // recalculate based on total
        setTotalRequests(responseTotal)
      }

      if (response_data.stats) {
        setGlobalStats({
          total: Number(response_data.stats.total) || 0,
          pending: Number(response_data.stats.pending) || 0,
          approved: Number(response_data.stats.approved) || 0,
          rejected: Number(response_data.stats.rejected) || 0,
        })
      }

      // Update types dinamically
      const uniqueTypes = Array.from(new Set(data.map((i: any) => i?.type).filter(Boolean))) as string[]
      setFilterOptions(prev => ({ ...prev, types: ["Todos", ...uniqueTypes] }))

      const transformedData: RequestData[] = data
        .filter((item: any) => item && item.id)
        .map((item: any) => {
          // Basic formatting helpers
          const formatDate = (d: string) => {
            try {
              const date = new Date(d);
              return !isNaN(date.getTime()) ? date.toLocaleDateString("es-ES", { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : d
            } catch { return d }
          }

          let formattedDates = "N/A"
          if (item.dates && typeof item.dates === "string") {
            formattedDates = item.dates.split(',').map((d: string) => formatDate(d.trim())).join(', ')
          } else if (item.dates) {
            formattedDates = String(item.dates)
          } else if (item.zona) {
            formattedDates = String(item.zona)
          }

          let requestDate = "N/A"
          let submittedTime = "N/A"
          if (item.createdAt) {
            requestDate = formatDate(item.createdAt)
            try { submittedTime = new Date(item.createdAt).toLocaleTimeString("es-ES", { hour: '2-digit', minute: '2-digit' }) } catch { }
          }

          return {
            id: String(item.id),
            userName: item.name?.trim() || "Usuario Desconocido",
            userCode: item.code?.trim() || "N/A",
            userAvatar: item.password?.trim() || "N/A",
            requestType: item.type?.trim() || "Solicitud",
            requestDate,
            requestedDates: formattedDates,
            status: item.status === 'approved' ? 'Aprobado' : item.status === 'rejected' ? 'Rechazado' : 'Pendiente',
            days: Number(item.days) || 1,
            submittedTime,
            requestedTime: item.time || "",
            department: "General",
            priority: "Media",
            reason: item.reason || "",
            description: item.description || "",
            createdAt: item.createdAt
          }
        })

      if (hasActiveFilters) {
        setAllFilteredRequests(transformedData)
        setRequests(transformedData.slice((page - 1) * limit, page * limit))
      } else {
        setRequests(transformedData)
        setAllFilteredRequests([])
      }

    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Error al cargar datos")
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false)
      }
    }
  }, [filters, limit, isOnline, currentUser, activeSource])

  // --- Effects ---

  useEffect(() => {
    fetchCurrentUser()
  }, [fetchCurrentUser])

  useEffect(() => {
    // Only fetch requests after currentUser is loaded
    if (currentUser) {
      fetchFilterOptions()
      fetchRequests(1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  useEffect(() => {
    // Handle internal pagination for filtered results
    if (allFilteredRequests.length > 0) {
      setRequests(allFilteredRequests.slice((currentPage - 1) * limit, currentPage * limit))
    } else if (!loading && !allFilteredRequests.length && requests.length > 0 && !filters.search) {
      // Only refetch if we are not in client-side filtered mode
      fetchRequests(currentPage)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage])


  // --- Utils ---

  const activeFiltersCount = useMemo(() => {
    return [
      filters.status !== "Todos",
      filters.type !== "Todos",
      filters.priority !== "Todos",
      filters.dateFrom,
      filters.dateTo,
      filters.search
    ].filter(Boolean).length
  }, [filters, searchTerm])

  const clearAllFilters = () => {
    setFilters({
      status: "Todos",
      type: "Todos",
      priority: "Todos",
      dateFrom: "",
      dateTo: "",
      daysMin: "",
      daysMax: "",
      search: "",
    })
    setSearchTerm("")
    setCurrentPage(1)
  }

  const exportToExcel = () => {
    try {
      const data = (allFilteredRequests.length > 0 ? allFilteredRequests : requests).map(r => ({
        ID: r.id,
        Nombre: r.userName,
        Código: r.userCode,
        Tipo: r.requestType,
        Descripción: r.description,
        Fecha: r.requestDate,
        "Fechas Solicitadas": r.requestedDates,
        Estado: r.status
      }))
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Solicitudes");
      XLSX.writeFile(wb, `Solicitudes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      alert("Error al exportar")
    }
  }

  // --- Styles ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Aprobado': return { bg: 'bg-[#4cc253]/10', text: 'text-[#4cc253]', border: 'border-[#4cc253]/20', icon: CheckCircle }
      case 'Rechazado': return { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-100', icon: XCircle }
      default: return { bg: 'bg-orange-50', text: 'text-orange-500', border: 'border-orange-100', icon: Hourglass }
    }
  }

  // --- Render ---

  // Filtered requests for list display (client search)
  const displayRequests = useMemo(() => {
    if (!searchTerm) return requests;
    return requests.filter(r =>
      r.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.userCode.includes(searchTerm) ||
      r.requestType.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [requests, searchTerm])

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 lg:p-8 font-sans">

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-1">Centro de Solicitudes</h1>
            <p className="text-gray-500 font-medium">Gestiona y supervisa las solicitudes del personal</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => fetchRequests(currentPage)}
              disabled={loading}
              className="p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-600 transition-all shadow-sm"
            >
              <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={exportToExcel}
              className="flex items-center gap-2 px-5 py-3 bg-[#4cc253] text-white rounded-xl font-bold text-sm tracking-wide shadow-lg shadow-[#4cc253]/20 hover:bg-[#3da343] transition-all"
            >
              <Download className="h-4 w-4" />
              EXPORTAR
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Solicitudes', value: globalStats.total, icon: ClipboardList, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Pendientes', value: globalStats.pending, icon: Hourglass, color: 'text-orange-500', bg: 'bg-white' },
          { label: 'Aprobadas', value: globalStats.approved, icon: CheckCircle, color: 'text-[#4cc253]', bg: 'bg-white' },
          { label: 'Rechazadas', value: globalStats.rejected, icon: XCircle, color: 'text-red-500', bg: 'bg-white' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -5 }}
            className={`${stat.bg} p-6 rounded-3xl border border-gray-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] flex items-center justify-between`}
          >
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
            <div className={`p-3 rounded-2xl ${stat.color} bg-gray-50`}>
              <stat.icon className="h-6 w-6" />
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Card */}
      <div className="max-w-7xl mx-auto bg-white rounded-[32px] shadow-xl shadow-gray-100/50 border border-gray-100 overflow-hidden">

        {/* Source Tabs - Only show if NOT se_maintenance user */}
        {currentUser?.userType !== 'se_maintenance' && (
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => { setActiveSource('permisos'); setCurrentPage(1); }}
              className={`flex-1 py-4 text-sm font-bold tracking-wide uppercase transition-all border-b-2 ${activeSource === 'permisos'
                ? 'border-[#4cc253] text-[#4cc253] bg-white'
                : 'border-transparent text-gray-400 bg-gray-50/50 hover:bg-gray-50 hover:text-gray-600'
                }`}
            >
              Solicitudes de Permiso
            </button>
            <button
              onClick={() => { setActiveSource('postulaciones'); setCurrentPage(1); }}
              className={`flex-1 py-4 text-sm font-bold tracking-wide uppercase transition-all border-b-2 ${activeSource === 'postulaciones'
                ? 'border-[#4cc253] text-[#4cc253] bg-white'
                : 'border-transparent text-gray-400 bg-gray-50/50 hover:bg-gray-50 hover:text-gray-600'
                }`}
            >
              Postulaciones de Turno
            </button>
          </div>
        )}

        {/* Toolbar */}
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row gap-4 justify-between items-center bg-white">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5 group-focus-within:text-[#4cc253] transition-colors" />
            <input
              type="text"
              placeholder="Buscar por nombre, código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-gray-50 border-none rounded-2xl font-semibold text-gray-700 focus:ring-2 focus:ring-[#4cc253]/20 focus:bg-white transition-all placeholder:text-gray-400"
            />
          </div>

          <button
            onClick={() => setIsFilterModalOpen(true)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${activeFiltersCount > 0
              ? 'bg-[#4cc253] text-white shadow-lg shadow-[#4cc253]/20'
              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Filter className="h-4 w-4" />
            FILTROS
            {activeFiltersCount > 0 && (
              <span className="bg-white text-[#4cc253] px-2 py-0.5 rounded-full text-xs font-black">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Table / List */}
        <div className="overflow-x-auto">
          {loading && !displayRequests.length ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 text-[#4cc253] animate-spin mb-4" />
              <p className="text-gray-400 font-bold">Cargando solicitudes...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-gray-900 font-bold mb-2">Error al cargar</p>
              <p className="text-gray-500 text-sm mb-4">{error}</p>
              <button onClick={() => fetchRequests(currentPage)} className="text-[#4cc253] font-bold hover:underline">Reintentar</button>
            </div>
          ) : !displayRequests.length ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-300" />
              </div>
              <p className="text-gray-900 font-bold">No se encontraron resultados</p>
              <p className="text-gray-400 text-sm">Intenta ajustar los filtros de búsqueda</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="p-6 text-gray-400 font-bold text-xs uppercase tracking-widest">Empleado</th>
                  <th className="p-6 text-gray-400 font-bold text-xs uppercase tracking-widest hidden md:table-cell">{activeSource === 'postulaciones' ? 'Detalle' : 'Solicitud'}</th>
                  <th className="p-6 text-gray-400 font-bold text-xs uppercase tracking-widest hidden lg:table-cell">{activeSource === 'postulaciones' ? 'Zona' : 'Fechas'}</th>
                  <th className="p-6 text-gray-400 font-bold text-xs uppercase tracking-widest">Estado</th>
                  <th className="p-6 text-gray-400 font-bold text-xs uppercase tracking-widest"></th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {displayRequests.map((req, idx) => {
                    const style = getStatusColor(req.status)
                    return (
                      <motion.tr
                        key={req.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => { setSelectedRequest(req); setShowRequestDetails(true); }}
                        className="group hover:bg-gray-50/50 cursor-pointer border-b border-gray-50 last:border-none transition-colors"
                      >
                        <td className="p-6">
                          <div className="flex items-center gap-4">
                            <UserAvatar
                              cedula={req.userAvatar}
                              alt={req.userName}
                              className="h-12 w-12 rounded-2xl border-2 border-white shadow-sm"
                              defaultAvatar=""
                            />
                            <div>
                              <p className="font-bold text-gray-900">{req.userName}</p>
                              <p className="text-xs text-gray-500 font-mono font-medium">{req.userCode}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 hidden md:table-cell">
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800">{req.requestType}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-xs text-gray-500">{req.requestDate}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-6 hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {req.requestedDates.split(',').slice(0, 3).map((d, i) => (
                              <span key={i} className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold text-gray-600 border border-gray-200">{d.trim()}</span>
                            ))}
                            {req.requestedDates.split(',').length > 3 && (
                              <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-bold text-gray-400">+{req.requestedDates.split(',').length - 3}</span>
                            )}
                          </div>
                        </td>
                        <td className="p-6">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider ${style.bg} ${style.text} border ${style.border}`}>
                            <style.icon className="h-3.5 w-3.5 mr-2" />
                            {req.status}
                          </div>
                        </td>
                        <td className="p-6 text-right">
                          <div className="text-gray-300 group-hover:text-[#4cc253] transition-colors">
                            <ChevronDown className="-rotate-90 h-5 w-5" />
                          </div>
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50/30">
            <span className="text-sm text-gray-500 font-bold">Página {currentPage} de {totalPages}</span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 disabled:opacity-50 hover:bg-gray-50"
              >
                Anterior
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 disabled:opacity-50 hover:bg-gray-50"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Filter Modal - Minimalist */}
      <AnimatePresence>
        {isFilterModalOpen && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsFilterModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-[32px] shadow-2xl p-8 border border-gray-100 overflow-hidden"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">Filtros</h2>
                  <p className="text-gray-500 text-sm font-medium">Refina tu búsqueda</p>
                </div>
                <button onClick={() => setIsFilterModalOpen(false)} className="p-2 bg-gray-50 rounded-full hover:bg-gray-100">
                  <X className="h-5 w-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Estado</label>
                  <div className="flex flex-wrap gap-2">
                    {filterOptions.statuses.map(s => (
                      <button
                        key={s}
                        onClick={() => setFilters(f => ({ ...f, status: f.status === s ? 'Todos' : s }))}
                        className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filters.status === s
                          ? 'bg-[#4cc253] text-white shadow-lg shadow-[#4cc253]/20'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                          }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Tipo</label>
                  <select
                    value={filters.type}
                    onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl font-bold text-gray-700 focus:ring-2 focus:ring-[#4cc253]/20"
                  >
                    {filterOptions.types.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Dates */}
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Rango de fechas</label>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border-none rounded-xl font-medium text-gray-700 text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                        className="w-full p-3 bg-gray-50 border-none rounded-xl font-medium text-gray-700 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-8 flex gap-4">
                <button
                  onClick={clearAllFilters}
                  className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  Limpiar
                </button>
                <button
                  onClick={() => { setCurrentPage(1); fetchRequests(1); setIsFilterModalOpen(false); }}
                  className="flex-[2] py-4 bg-[#4cc253] text-white font-black rounded-2xl hover:bg-[#3da343] transition-all shadow-xl shadow-[#4cc253]/20"
                >
                  Aplicar Filtros
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modal Wrapper */}
      <AnimatePresence>
        {showRequestDetails && selectedRequest && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-0 bg-black/60 backdrop-blur-sm">
            <RequestDetails
              request={{
                ...selectedRequest,
                code: selectedRequest.userCode,
                name: selectedRequest.userName,
                type: selectedRequest.requestType,
                time: selectedRequest.requestedTime || selectedRequest.submittedTime,
                createdAt: selectedRequest.createdAt || new Date().toISOString()
              }}
              onClose={() => { setShowRequestDetails(false); setSelectedRequest(null); }}
              onAction={(id, action, reason) => {
                // Logic handled inside RequestDetails or triggering refetch here
                setShowRequestDetails(false);
                setSelectedRequest(null);
                fetchRequests(currentPage);
              }}
              onPrevRequest={() => { }}
              onNextRequest={() => { }}
            />
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}
