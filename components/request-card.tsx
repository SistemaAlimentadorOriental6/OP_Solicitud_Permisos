"use client"

import React, { useState, useCallback, memo, useMemo } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileText,
  Timer,
  Calendar,
  Shield,
  Clock,
  Users,
  Target,
  Briefcase,
  AlertCircle,
  MapPin,
  ArrowRight,
  Eye,
  Edit,
  Download,
  Trash2,
  MoreVertical,
  Sparkles,
  Zap,
  Star,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  X,
  Activity,
  Plus,
  Minus,
  Search,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  Building2,
  Hash,
  Filter,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  BarChart3,
  PieChart,
  MessageSquare,
  Paperclip,
  Send,
  Loader2,
  RefreshCw
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { format, parseISO, isValid } from "date-fns"
import { es } from "date-fns/locale"
import type { Request } from "@/hooks/use-permits"

interface RequestCardProps {
  name: string
  requests: Request[]
  onRequestClick: (request: Request) => void
  selectedRequestIds: Set<string>
  onDelete: (request: Request) => void
}

// Unified date formatting function
const formatDateForCard = (dateString: string) => {
  if (!dateString) return "Fecha no disponible"
  try {
    if (dateString.includes(",")) {
      const fechas = dateString.split(",").map((fecha) => {
        const fechaTrim = fecha.trim()
        try {
          const date = parseISO(fechaTrim)
          return isValid(date) ? format(date, "d MMM", { locale: es }) : fechaTrim
        } catch {
          return fechaTrim
        }
      })
      return fechas.join(", ")
    }
    const date = parseISO(dateString)
    if (!isValid(date)) {
      const matches = dateString.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
      if (matches) {
        const [_, day, month, year] = matches
        const newDate = new Date(`${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`)
        if (isValid(newDate)) {
          return format(newDate, "d MMM", { locale: es })
        }
      }
      return dateString
    }
    return format(date, "d MMM", { locale: es })
  } catch (error) {
    console.error("Error al formatear fecha:", error, dateString)
    return dateString
  }
}

// Enhanced User Avatar Component
const UserAvatar = memo(({ name, photoUrl, size = "md", showStatus = true }: {
  name: string;
  photoUrl?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  showStatus?: boolean;
}) => {
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(true)

  const sizeClasses = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-[11px]",
    md: "w-10 h-10 text-xs",
    lg: "w-14 h-14 text-base",
    xl: "w-20 h-20 text-lg"
  }

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={`relative ${sizeClasses[size]} flex-shrink-0`}>
      <div className={`w-full h-full rounded-full overflow-hidden border border-green-100 bg-white shadow-sm transition-all duration-300 group-hover:border-[#4cc253]`}>
        {photoUrl && !imageError ? (
          <img
            src={photoUrl}
            alt={name}
            className={`w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
            onLoad={() => setImageLoading(false)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-green-50 text-green-700 font-bold italic">
            {initials}
          </div>
        )}
      </div>

      {showStatus && (
        <span className="absolute bottom-0.5 right-0.5 block h-2.5 w-2.5 rounded-full bg-[#4cc253] ring-2 ring-white shadow-sm" />
      )}
    </div>
  )
})

UserAvatar.displayName = "UserAvatar"

// Enhanced Status Badge Component
const StatusBadge = memo(({ status, size = "sm" }: { status: string; size?: "xs" | "sm" | "md" }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aprobado':
        return {
          icon: CheckCircle2,
          color: 'bg-[#4cc253] text-white border-[#4cc253]',
        }
      case 'rechazado':
        return {
          icon: XCircle,
          color: 'bg-white text-green-900 border-green-200',
        }
      case 'pendiente':
      default:
        return {
          icon: Clock,
          color: 'bg-green-50 text-green-700 border-green-100',
        }
    }
  }

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm'
  }

  const config = getStatusConfig(status)
  const IconComponent = config.icon

  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full border ${config.color} ${sizeClasses[size]} font-semibold shadow-sm transition-all hover:scale-105`}>
      <IconComponent className="h-3 w-3" />
      <span className="capitalize">{status}</span>
    </div>
  )
})

StatusBadge.displayName = "StatusBadge"

// Request Statistics Component
const RequestStats = memo(({ requests }: { requests: Request[] }) => {
  const stats = useMemo(() => {
    const total = requests.length
    const byType = requests.reduce((acc, req) => {
      acc[req.type] = (acc[req.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byStatus = requests.reduce((acc, req) => {
      const status = req.status || 'pendiente'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    return { total, byType, byStatus }
  }, [requests])

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-gradient-to-br from-emerald-50 to-green-50 p-4 rounded-2xl border-2 border-emerald-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-emerald-100 rounded-xl">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
          </div>
          <h4 className="font-semibold text-emerald-800">Total</h4>
        </div>
        <p className="text-2xl font-bold text-emerald-900">{stats.total}</p>
        <p className="text-sm text-emerald-600">Solicitudes</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-2xl border-2 border-blue-200">
        <div className="flex items-center space-x-3 mb-3">
          <div className="p-2 bg-blue-100 rounded-xl">
            <PieChart className="h-4 w-4 text-blue-600" />
          </div>
          <h4 className="font-semibold text-blue-800">Tipos</h4>
        </div>
        <p className="text-2xl font-bold text-blue-900">{Object.keys(stats.byType).length}</p>
        <p className="text-sm text-blue-600">Diferentes</p>
      </div>
    </div>
  )
})

RequestStats.displayName = "RequestStats"

// Detailed Request Item Component
const DetailedRequestItem = memo(({
  request,
  onEdit,
  onDelete,
  isSelected,
  onSelect,
  onRequestClick
}: {
  request: Request;
  onEdit: (request: Request) => void;
  onDelete: (request: Request) => void;
  isSelected: boolean;
  onSelect: (request: Request) => void;
  onRequestClick: (request: Request) => void;
}) => {
  return (
    <motion.div
      layout
      className={`group relative flex flex-col gap-3 rounded-xl border p-4 transition-all duration-300 cursor-pointer ${isSelected
          ? 'border-[#4cc253] bg-green-50/50 shadow-md ring-1 ring-green-500/10'
          : 'border-green-100 bg-white hover:border-[#4cc253] hover:shadow-soft'
        }`}
      onClick={() => onRequestClick(request)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg border border-green-100 bg-green-50 text-[#4cc253]`}>
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-green-950 leading-tight">{request.type}</h4>
            <span className="text-[10px] font-bold uppercase tracking-widest text-green-400">ID: {request.code}</span>
          </div>
        </div>
        <StatusBadge status={request.status || 'pendiente'} size="xs" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-green-800/70">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-[#4cc253]" />
          <span>
            {request.dates
              ? Array.isArray(request.dates)
                ? request.dates.length > 1
                  ? `${formatDateForCard(request.dates[0])} - ${formatDateForCard(request.dates[request.dates.length - 1])}`
                  : formatDateForCard(request.dates[0])
                : formatDateForCard(request.dates.toString())
              : "Sin fecha definida"}
          </span>
        </div>
        {request.zona && (
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-[#4cc253]" />
            <span>{request.zona}</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-green-50 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400 hover:text-green-700 hover:bg-green-50" onClick={(e) => { e.stopPropagation(); onEdit(request); }}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-400 hover:text-red-900 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete(request); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  )
})

DetailedRequestItem.displayName = "DetailedRequestItem"

// Enhanced Detailed View Modal
const DetailedViewModal = memo(({
  name,
  requests,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onRequestClick
}: {
  name: string;
  requests: Request[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (request: Request) => void;
  onDelete: (request: Request) => void;
  onRequestClick: (request: Request) => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [filterType, setFilterType] = useState("all")
  const [selectedRequests, setSelectedRequests] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 6

  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      const matchesSearch = request.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (request.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)

      const matchesFilter = filterType === "all" || request.type === filterType

      return matchesSearch && matchesFilter
    })
  }, [requests, searchTerm, filterType])

  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredRequests.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredRequests, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage)

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(requests.map(r => r.type)))
  }, [requests])

  const handleSelectRequest = useCallback((request: Request) => {
    setSelectedRequests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(request.id)) {
        newSet.delete(request.id)
      } else {
        newSet.add(request.id)
      }
      return newSet
    })
  }, [])

  // Auto-close modal when any request is selected
  const handleRequestClickWithAutoClose = useCallback((request: Request) => {
    onRequestClick(request)
    // Close modal immediately when any request is clicked
    onClose()
  }, [onRequestClick, onClose])

  const handleSelectAll = useCallback(() => {
    if (selectedRequests.size === paginatedRequests.length) {
      setSelectedRequests(new Set())
    } else {
      setSelectedRequests(new Set(paginatedRequests.map(r => r.id)))
    }
  }, [selectedRequests.size, paginatedRequests])

  if (!isOpen) return null

  const modalContent = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto"
        onClick={onClose}
        style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 50 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 50 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-emerald-600 p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500 rounded-full blur-3xl opacity-50"></div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-6">
                <div className="p-1 bg-white rounded-full shadow-lg">
                  <UserAvatar name={name} size="lg" showStatus={false} />
                </div>
                <div className="text-white">
                  <h2 className="text-4xl font-black tracking-tight drop-shadow-md">{name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="px-2 py-0.5 bg-emerald-500 rounded-md text-[10px] font-black uppercase tracking-widest border border-emerald-400">
                      Empleado Activo
                    </div>
                    <p className="text-emerald-50 text-sm font-bold opacity-90">
                      • {requests.length} solicitud{requests.length !== 1 ? "es" : ""} registrada{requests.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                className="text-white hover:bg-white/20 rounded-full h-12 w-12 p-0"
              >
                <X className="h-6 w-6" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Statistics */}
            <RequestStats requests={requests} />

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-4 mb-8">
              <div className="flex-1 relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-emerald-400 h-5 w-5 transition-colors group-focus-within:text-emerald-600" />
                <Input
                  placeholder="Buscar por tipo, código o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-12 h-12 border-emerald-100 focus:border-emerald-500 rounded-xl bg-emerald-50/10 font-medium"
                />
              </div>

              <div className="flex gap-3">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-4 h-12 border border-emerald-100 rounded-xl focus:border-emerald-500 focus:outline-none bg-white font-bold text-emerald-800 shadow-sm cursor-pointer"
                >
                  <option value="all">Filtro: Todos</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  className="h-12 px-6 border-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white rounded-xl font-bold transition-all shadow-sm"
                >
                  {selectedRequests.size === paginatedRequests.length ? (
                    <>
                      <Minus className="h-4 w-4 mr-2" />
                      Deseleccionar
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Selección Múltiple
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Selected count */}
            {selectedRequests.size > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-200 rounded-xl"
              >
                <p className="text-emerald-800 font-semibold">
                  {selectedRequests.size} solicitud{selectedRequests.size !== 1 ? "es" : ""} seleccionada{selectedRequests.size !== 1 ? "s" : ""}
                </p>
              </motion.div>
            )}

            {/* Requests Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <AnimatePresence mode="popLayout">
                {paginatedRequests.map((request) => (
                  <DetailedRequestItem
                    key={request.id}
                    request={request}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    isSelected={selectedRequests.has(request.id)}
                    onSelect={handleSelectRequest}
                    onRequestClick={handleRequestClickWithAutoClose}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2">
                <Button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                  Página {currentPage} de {totalPages}
                </span>

                <Button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* No results */}
            {filteredRequests.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Search className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No se encontraron solicitudes</h3>
                <p className="text-gray-500">Intenta ajustar los filtros de búsqueda</p>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null
})

DetailedViewModal.displayName = "DetailedViewModal"

// Main RequestCard Component - Completely Redesigned
const RequestCard = memo(
  React.forwardRef<HTMLDivElement, RequestCardProps>(
    ({ name, requests, onRequestClick, selectedRequestIds, onDelete }, ref) => {
      const [showDetailedView, setShowDetailedView] = useState(false)
      const primaryRequest = requests[0]
      const hasSelectedRequests = requests.some((req) => selectedRequestIds.has(req.id))
      const isPostulacion = !["descanso", "cita", "audiencia", "licencia", "diaAM", "diaPM"].includes(
        primaryRequest?.type || "",
      )

      if (!requests.length) return null

      return (
        <>
          <motion.div
            ref={ref}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative h-full"
          >
            <ContextMenu>
              <ContextMenuTrigger>
                <Card className={`relative h-full overflow-hidden border-green-100 bg-white shadow-soft transition-all duration-300 hover:border-[#4cc253] hover:shadow-xl ${hasSelectedRequests ? 'ring-2 ring-[#4cc253] border-[#4cc253] bg-green-50/20' : ''}`}>
                  {/* Premium Accent Bar */}
                  <div className={`absolute left-0 top-0 h-1 w-full bg-[#4cc253] shadow-sm transition-transform duration-500 translate-y-[-100%] group-hover:translate-y-0`} />

                  <CardContent className="flex flex-col gap-4 p-5">
                    {/* Header: User Info & Status */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <UserAvatar name={name} size="md" />
                        <div className="flex flex-col min-w-0">
                          <h3 className="truncate text-sm font-black text-green-950 group-hover:text-[#4cc253] transition-colors">
                            {name}
                          </h3>
                          <div className={`inline-flex items-center gap-1.5 w-fit rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${isPostulacion ? 'bg-[#4cc253] text-white shadow-sm' : 'bg-green-50 text-green-700 border border-green-100'}`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${isPostulacion ? 'bg-white' : 'bg-[#4cc253]'}`} />
                            {isPostulacion ? 'Postulación' : 'Permiso'}
                          </div>
                        </div>
                      </div>
                      <StatusBadge status="Pendiente" size="xs" />
                    </div>

                    {/* Main Content Area */}
                    <div className="space-y-3">
                      {/* Primary Request Summary */}
                      <div
                        className={`flex items-start gap-4 rounded-xl border border-green-50 bg-green-50/20 p-4 transition-all hover:bg-white hover:border-green-300 hover:shadow-soft cursor-pointer ${selectedRequestIds.has(primaryRequest.id) ? 'bg-white border-[#4cc253] shadow-md ring-1 ring-green-500/10' : ''}`}
                        onClick={() => onRequestClick(primaryRequest)}
                      >
                        <div className="flex-1 min-w-0 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-green-100 text-green-700 shadow-sm">
                              <FileText className="h-3.5 w-3.5" />
                            </div>
                            <p className="truncate text-sm font-bold text-green-900">{primaryRequest.type}</p>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-[11px] font-bold text-green-700/70">
                              <Calendar className="h-3.5 w-3.5 text-[#4cc253]" />
                              <span className="truncate">
                                {primaryRequest.dates
                                  ? Array.isArray(primaryRequest.dates)
                                    ? formatDateForCard(primaryRequest.dates[0])
                                    : formatDateForCard(primaryRequest.dates.toString())
                                  : 'Fecha pendiente'}
                              </span>
                            </div>
                            {primaryRequest.zona && (
                              <div className="flex items-center gap-2 text-[11px] font-bold text-green-700/70">
                                <MapPin className="h-3.5 w-3.5 text-[#4cc253]" />
                                <span className="truncate">{primaryRequest.zona}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] font-black font-mono text-green-400 bg-white px-2 py-1 rounded-lg border border-green-50 shadow-sm">
                          ID:{primaryRequest.code}
                        </div>
                      </div>

                      {/* Other Requests Snippet */}
                      {requests.length > 1 && (
                        <div className="flex items-center justify-between px-1">
                          <div className="flex -space-x-2 overflow-hidden">
                            {requests.slice(1, 4).map((r, i) => (
                              <div key={r.id} title={r.type} className="inline-block h-6 w-6 rounded-full border-2 border-white bg-[#4cc253] flex items-center justify-center text-[9px] font-black text-white shadow-sm ring-1 ring-green-200">
                                {r.type[0].toUpperCase()}
                              </div>
                            ))}
                            {requests.length > 4 && (
                              <div className="inline-block h-6 w-6 rounded-full border-2 border-white bg-green-50 flex items-center justify-center text-[9px] font-black text-green-700 shadow-sm ring-1 ring-green-100">
                                +{requests.length - 4}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setShowDetailedView(true); }}
                            className="h-8 px-4 text-[11px] font-bold text-[#4cc253] hover:text-white hover:bg-[#4cc253] rounded-full transition-all border border-green-50 hover:border-green-600 shadow-sm"
                          >
                            Ver {requests.length} solicitudes
                          </Button>
                        </div>
                      )}

                      {requests.length === 1 && (
                        <div className="flex justify-end pt-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setShowDetailedView(true); }}
                            className="h-9 px-5 text-[11px] font-bold text-green-700 hover:text-white hover:bg-[#4cc253] rounded-full transition-all border border-green-100 hover:border-[#4cc253] group/btn shadow-soft"
                          >
                            Gestionar Solicitud
                            <ArrowRight className="h-3.5 w-3.5 ml-2 transition-transform group-hover/btn:translate-x-1" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </ContextMenuTrigger>

              <ContextMenuContent className="w-64 rounded-xl border border-green-100 bg-white/95 p-2 shadow-2xl backdrop-blur-lg">
                <div className="px-3 py-2 text-[10px] font-black uppercase text-green-400 tracking-widest border-b border-green-50 mb-1.5 flex items-center justify-between">
                  <span>Acciones</span>
                  <Activity className="h-3 w-3" />
                </div>
                {requests.map((request) => (
                  <ContextMenuItem
                    key={request.id}
                    onClick={() => onDelete(request)}
                    className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-green-950 font-bold outline-none transition-all hover:bg-green-50 hover:text-green-700 cursor-pointer"
                  >
                    <div className="p-1.5 rounded-md bg-green-100 shadow-sm">
                      <Trash2 className="h-4 w-4 text-green-600" />
                    </div>
                    <span>Eliminar {request.type}</span>
                  </ContextMenuItem>
                ))}
              </ContextMenuContent>
            </ContextMenu>
          </motion.div>

          <DetailedViewModal
            name={name}
            requests={requests}
            isOpen={showDetailedView}
            onClose={() => setShowDetailedView(false)}
            onEdit={(req) => console.log('Edit', req)}
            onDelete={onDelete}
            onRequestClick={onRequestClick}
          />
        </>
      )
    },
  ),
)

RequestCard.displayName = "RequestCard"

export default RequestCard