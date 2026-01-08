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
      <div className={`w-full h-full rounded-2xl overflow-hidden border-2 border-gray-100 bg-white shadow-sm transition-all duration-300 group-hover:border-[#4cc253]/50`}>
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
          <div className="w-full h-full flex items-center justify-center bg-gray-50 text-gray-400 font-black text-xs italic">
            {initials}
          </div>
        )}
      </div>

      {showStatus && (
        <span className="absolute -bottom-1 -right-1 block h-3 w-3 rounded-full bg-[#4cc253] ring-2 ring-white shadow-sm" />
      )}
    </div>
  )
})

UserAvatar.displayName = "UserAvatar"

// Enhanced Status Badge Component
const StatusBadge = memo(({ status, size = "sm" }: { status: string; size?: "xs" | "sm" | "md" }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'aprobado':
        return {
          color: 'bg-[#4cc253] text-white',
          text: 'Aprobado'
        }
      case 'cancelled':
      case 'rechazado':
      case 'rejected':
        return {
          color: 'bg-red-500 text-white',
          text: 'Rechazado'
        }
      case 'pending':
      case 'pendiente':
      default:
        return {
          color: 'bg-amber-500 text-white',
          text: 'Pendiente'
        }
    }
  }

  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[9px]',
    sm: 'px-2.5 py-1 text-[10px]',
    md: 'px-3 py-1.5 text-xs'
  }

  const config = getStatusConfig(status)

  return (
    <div className={`inline-flex items-center rounded-full ${config.color} ${sizeClasses[size]} font-black uppercase tracking-wider shadow-sm transition-all`}>
      <span>{config.text}</span>
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

    return { total, byTypeCount: Object.keys(byType).length }
  }, [requests])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
      <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-6 group hover:border-[#4cc253]/30 transition-all">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-[#4cc253]/10 transition-colors">
          <BarChart3 className="h-8 w-8 text-[#4cc253]" />
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Total Solicitudes</p>
          <p className="text-4xl font-black text-gray-900 tracking-tight">{stats.total}</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2rem] border border-gray-100 shadow-sm flex items-center gap-6 group hover:border-[#4cc253]/30 transition-all">
        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-[#4cc253]/10 transition-colors">
          <PieChart className="h-8 w-8 text-[#4cc253]" />
        </div>
        <div>
          <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Tipos Diferentes</p>
          <p className="text-4xl font-black text-gray-900 tracking-tight">{stats.byTypeCount}</p>
        </div>
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
      className={`group/inner relative flex flex-col gap-6 rounded-[2rem] border p-6 transition-all duration-500 cursor-pointer ${isSelected
        ? 'border-[#4cc253] bg-[#4cc253]/5 shadow-lg ring-1 ring-[#4cc253]/10'
        : 'border-gray-100 bg-white hover:border-[#4cc253]/30 hover:shadow-xl'
        }`}
      onClick={() => onRequestClick(request)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`p-4 rounded-2xl bg-gray-50 text-[#4cc253] border border-gray-100 group-hover/inner:bg-[#4cc253] group-hover/inner:text-white transition-all duration-300`}>
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tipo de Novedad</p>
            <h4 className="text-lg font-black text-gray-900 tracking-tight capitalize">{request.type}</h4>
            <span className="text-[10px] font-black uppercase tracking-tighter text-gray-400">ID: {request.code}</span>
          </div>
        </div>
        <StatusBadge status={request.status || 'pendiente'} size="sm" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
            <Calendar className="h-4 w-4 text-[#4cc253]" />
          </div>
          <div>
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Fecha Solicitada</p>
            <p className="text-sm font-bold text-gray-800 mt-0.5">
              {request.dates
                ? Array.isArray(request.dates)
                  ? request.dates.length > 1
                    ? `${formatDateForCard(request.dates[0])} - ${formatDateForCard(request.dates[request.dates.length - 1])}`
                    : formatDateForCard(request.dates[0])
                  : formatDateForCard(request.dates.toString())
                : "Sin fecha"}
            </p>
          </div>
        </div>

        {request.zona && (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
              <MapPin className="h-4 w-4 text-[#4cc253]" />
            </div>
            <div>
              <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Zona / Ubicación</p>
              <p className="text-sm font-bold text-gray-800 mt-0.5">{request.zona}</p>
            </div>
          </div>
        )}

        {(request.type?.toLowerCase().includes('turno pareja') || (request as any).noveltyType?.toLowerCase().includes('turno pareja')) && (
          <>
            {(request.comp_am || (request as any).codeAM) && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                  <User className="h-4 w-4 text-[#4cc253]" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Pareja AM</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{request.comp_am || (request as any).codeAM}</p>
                </div>
              </div>
            )}
            {(request.comp_pm || (request as any).codePM) && (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center border border-gray-100">
                  <User className="h-4 w-4 text-[#4cc253]" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Pareja PM</p>
                  <p className="text-sm font-bold text-gray-800 mt-0.5">{request.comp_pm || (request as any).codePM}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-4 border-t border-gray-50">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 px-4 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 font-bold"
          onClick={(e) => { e.stopPropagation(); onDelete(request); }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Eliminar
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
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-gray-50 rounded-[3rem] shadow-2xl max-w-6xl w-full max-h-[92vh] overflow-hidden border border-white"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-[#4cc253] p-10 relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute inset-0 opacity-10 mix-blend-overlay">
              <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
            </div>

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-8">
                <div className="p-1 bg-white/20 backdrop-blur-md rounded-[2rem] shadow-xl border border-white/30">
                  <UserAvatar name={name} size="xl" showStatus={false} />
                </div>
                <div>
                  <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tight leading-none mb-3 drop-shadow-sm">
                    {name}
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 bg-white text-[#4cc253] rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">
                      Empleado Activo
                    </div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
                    <p className="text-white/90 text-sm font-bold tracking-tight">
                      {requests.length} solicitud{requests.length !== 1 ? "es" : ""} registrada{requests.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={onClose}
                variant="ghost"
                className="text-white hover:bg-white/20 rounded-2xl h-14 w-14 p-0 backdrop-blur-sm transition-all hover:rotate-90"
              >
                <X className="h-8 w-8" />
              </Button>
            </div>
          </div>

          <div className="p-10 overflow-y-auto max-h-[calc(92vh-220px)] space-y-10">
            {/* Statistics */}
            <RequestStats requests={requests} />

            {/* Controls */}
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 relative group">
                <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400 h-6 w-6 transition-all group-focus-within:text-[#4cc253]" />
                <Input
                  placeholder="Buscar por tipo, código o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-16 h-16 border-gray-100 focus:border-[#4cc253]/30 focus:ring-4 focus:ring-[#4cc253]/10 rounded-[2rem] bg-white font-bold text-gray-800 transition-all text-lg shadow-sm"
                />
              </div>

              <div className="flex gap-4">
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="appearance-none pl-6 pr-12 h-16 border border-gray-100 rounded-[2rem] focus:border-[#4cc253]/30 focus:ring-4 focus:ring-[#4cc253]/10 bg-white font-black text-[10px] uppercase tracking-[0.2em] text-gray-500 shadow-sm cursor-pointer transition-all min-w-[200px]"
                  >
                    <option value="all">Filtro: Todos</option>
                    {uniqueTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
                </div>

                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  className={`h-16 px-8 rounded-[2rem] font-black uppercase text-[10px] tracking-[0.2em] transition-all shadow-sm ${selectedRequests.size === paginatedRequests.length
                    ? 'bg-[#4cc253] text-white border-[#4cc253] hover:bg-[#3da343]'
                    : 'bg-white text-gray-500 border-gray-100 hover:border-[#4cc253]/30 hover:text-[#4cc253]'
                    }`}
                >
                  {selectedRequests.size === paginatedRequests.length ? (
                    <>
                      <Minus className="h-4 w-4 mr-3" />
                      Deseleccionar
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-3" />
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
                <Card className={`relative h-full overflow-hidden border-gray-100 bg-white shadow-sm transition-all duration-500 rounded-[2.5rem] hover:border-[#4cc253]/30 hover:shadow-xl ${hasSelectedRequests ? 'ring-2 ring-[#4cc253]/20 border-[#4cc253]/50 bg-[#4cc253]/5' : ''}`}>
                  {/* Premium Accent Bar */}
                  <div className={`absolute top-0 right-0 w-32 h-32 bg-[#4cc253]/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150`} />

                  <CardContent className="flex flex-col gap-4 p-5">
                    {/* Header: User Info & Status */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-4 overflow-hidden">
                        <UserAvatar name={name} size="md" />
                        <div className="flex flex-col min-w-0">
                          <h3 className="truncate text-lg font-black text-gray-900 tracking-tight group-hover:text-[#4cc253] transition-colors leading-tight">
                            {name}
                          </h3>
                          <div className={`inline-flex items-center gap-1.5 w-fit rounded-full px-2 py-0.5 mt-1`}>
                            <div className={`h-1.5 w-1.5 rounded-full ${isPostulacion ? 'bg-[#4cc253] shadow-[0_0_8px_rgba(76,194,83,0.5)]' : 'bg-gray-400'}`} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                              {isPostulacion ? 'Postulación' : 'Permiso'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <StatusBadge status={primaryRequest.status || "pendiente"} size="xs" />
                    </div>

                    {/* Main Content Area */}
                    <div className="space-y-3">
                      {/* Primary Request Summary */}
                      <div
                        className={`group/inner flex items-start gap-4 rounded-3xl border border-gray-100 bg-gray-50/50 p-5 transition-all hover:bg-white hover:border-[#4cc253]/30 hover:shadow-lg cursor-pointer ${selectedRequestIds.has(primaryRequest.id) ? 'bg-white border-[#4cc253] shadow-md ring-1 ring-[#4cc253]/10' : ''}`}
                        onClick={() => onRequestClick(primaryRequest)}
                      >
                        <div className="flex-1 min-w-0 space-y-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-white text-[#4cc253] shadow-sm border border-gray-100 group-hover/inner:bg-[#4cc253] group-hover/inner:text-white transition-all">
                              <FileText className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Tipo de Novedad</p>
                              <p className="truncate text-sm font-black text-gray-900">{primaryRequest.type}</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center">
                                <Calendar className="h-3.5 w-3.5 text-[#4cc253]" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Fecha</p>
                                <p className="truncate text-xs font-bold text-gray-800 mt-0.5">
                                  {primaryRequest.dates
                                    ? Array.isArray(primaryRequest.dates)
                                      ? formatDateForCard(primaryRequest.dates[0])
                                      : formatDateForCard(primaryRequest.dates.toString())
                                    : 'Pendiente'}
                                </p>
                              </div>
                            </div>
                            {primaryRequest.zona && (
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-white border border-gray-100 flex items-center justify-center">
                                  <MapPin className="h-3.5 w-3.5 text-[#4cc253]" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Zona</p>
                                  <p className="truncate text-xs font-bold text-gray-800 mt-0.5">{primaryRequest.zona}</p>
                                </div>
                              </div>
                            )}

                            {(primaryRequest.type?.toLowerCase().includes('turno pareja') || (primaryRequest as any).noveltyType?.toLowerCase().includes('turno pareja')) && (
                              <>
                                {(primaryRequest.comp_am || (primaryRequest as any).codeAM) && (
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                                      <User className="h-3 w-3 text-[#4cc253]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Pareja AM</p>
                                      <p className="truncate text-xs font-bold text-gray-800 mt-0.5">{primaryRequest.comp_am || (primaryRequest as any).codeAM}</p>
                                    </div>
                                  </div>
                                )}
                                {(primaryRequest.comp_pm || (primaryRequest as any).codePM) && (
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center">
                                      <User className="h-3 w-3 text-[#4cc253]" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Pareja PM</p>
                                      <p className="truncate text-xs font-bold text-gray-800 mt-0.5">{primaryRequest.comp_pm || (primaryRequest as any).codePM}</p>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-[9px] font-black text-gray-400 bg-white px-2 py-1.5 rounded-lg border border-gray-100 shadow-sm uppercase tracking-tighter">
                            ID:{primaryRequest.code}
                          </div>
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
                            className="h-10 px-6 text-[10px] font-black uppercase tracking-widest text-[#4cc253] hover:text-white hover:bg-[#4cc253] rounded-2xl transition-all border border-gray-100 hover:border-[#4cc253] group/btn shadow-sm"
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

              <ContextMenuContent className="w-80 rounded-[2rem] border border-gray-100 bg-white/95 p-3 shadow-2xl backdrop-blur-xl">
                <div className="px-4 py-3 text-[10px] font-black uppercase text-gray-400 tracking-[0.2em] border-b border-gray-50 mb-2 flex items-center justify-between">
                  <span>Acciones Disponibles</span>
                  <Activity className="h-3 w-3 text-[#4cc253]" />
                </div>
                {requests.map((request) => (
                  <ContextMenuItem
                    key={request.id}
                    onClick={() => onDelete(request)}
                    className="flex flex-col items-start gap-1 rounded-2xl px-4 py-3 outline-none transition-all hover:bg-red-50 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 w-full">
                      <div className="p-2 rounded-xl bg-gray-50 text-gray-400 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-gray-900 leading-none mb-1 group-hover:text-red-600 transition-colors">Eliminar {request.type}</p>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {request.dates
                              ? Array.isArray(request.dates)
                                ? request.dates.length > 1
                                  ? `${formatDateForCard(request.dates[0])} - ${formatDateForCard(request.dates[request.dates.length - 1])}`
                                  : formatDateForCard(request.dates[0])
                                : formatDateForCard(request.dates.toString())
                              : "Sin fecha"}
                          </span>
                        </div>
                      </div>
                    </div>
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