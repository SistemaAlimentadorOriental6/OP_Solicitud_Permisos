"use client"

import React, { useState, useEffect, useCallback, useMemo, memo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { createPortal } from "react-dom"
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isSameDay, getWeek } from "date-fns"
import { es } from "date-fns/locale"
import { useRBACContext } from "./RBACProvider"
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  FileText,
  Laptop,
  Timer,
  Calendar,
  Shield,
  Clock,
  Users,
  Target,
  Briefcase,
  X,
  TrendingUp,
  Eye,
  Filter,
  Download,
  BarChart3,
  CheckCircle,
  AlertCircle,
  XCircle,
  Star,
  Zap,
  Award,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { Request } from "../hooks/use-permits"

interface WeeklyStatsProps {
  requests: Request[]
}

interface DayModalProps {
  isOpen: boolean
  onClose: () => void
  dayData: {
    day: string
    date: Date
    dayName: string
    count: number
    requests: Request[]
    dateKey: string
  } | null
}

const DayModal: React.FC<DayModalProps> = ({ isOpen, onClose, dayData }) => {
  const [filterType, setFilterType] = useState<string>("all")

  const getTypeIcon = useCallback((type: string) => {
    const icons: Record<string, React.ReactNode> = {
      descanso: <Timer className="h-5 w-5" />,
      cita: <Calendar className="h-5 w-5" />,
      audiencia: <Shield className="h-5 w-5" />,
      licencia: <FileText className="h-5 w-5" />,
      diaAM: <Clock className="h-5 w-5" />,
      diaPM: <Clock className="h-5 w-5" />,
      "Turno pareja": <Users className="h-5 w-5" />,
      "Tabla partida": <Target className="h-5 w-5" />,
      "Disponible fijo": <Briefcase className="h-5 w-5" />,
    }
    return icons[type] || <FileText className="h-5 w-5" />
  }, [])

  const getStatusColor = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "bg-[#fffbe6] text-[#b54708] border-[#fef0c7]"
      case "approved":
        return "bg-[#f0faf2] text-[#33b150] border-[#d1f2d9]"
      case "rejected":
        return "bg-[#fff1f0] text-[#b42318] border-[#fee4e2]"
      default:
        return "bg-gray-50 text-gray-600 border-gray-100"
    }
  }, [])

  const getStatusIcon = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return <AlertCircle className="h-4 w-4" />
      case "approved":
        return <CheckCircle className="h-4 w-4" />
      case "rejected":
        return <XCircle className="h-4 w-4" />
      default:
        return <AlertCircle className="h-4 w-4" />
    }
  }, [])

  const getStatusText = useCallback((status: string) => {
    switch (status.toLowerCase()) {
      case "pending":
        return "Pendiente"
      case "approved":
        return "Aprobada"
      case "rejected":
        return "Rechazada"
      default:
        return status
    }
  }, [])

  const getTypeName = useCallback((type: string) => {
    const typeNames: Record<string, string> = {
      descanso: "Descanso",
      cita: "Cita médica",
      audiencia: "Audiencia",
      licencia: "Licencia no remunerada",
      diaAM: "Día AM",
      diaPM: "Día PM",
      "Turno pareja": "Turno pareja",
      "Tabla partida": "Tabla partida",
      "Disponible fijo": "Disponible fijo",
    }
    return typeNames[type] || type
  }, [])

  const filteredRequests = useMemo(() => {
    if (!dayData) return []
    if (filterType === "all") return dayData.requests
    return dayData.requests.filter(request => request.type === filterType)
  }, [dayData, filterType])

  const typeStats = useMemo(() => {
    if (!dayData) return {}
    const stats: Record<string, { count: number; approved: number; pending: number; rejected: number }> = {}

    dayData.requests.forEach(request => {
      if (!stats[request.type]) {
        stats[request.type] = { count: 0, approved: 0, pending: 0, rejected: 0 }
      }
      stats[request.type].count++
      stats[request.type][request.status.toLowerCase() as keyof typeof stats[string]]++
    })

    return stats
  }, [dayData])

  const uniqueTypes = useMemo(() => {
    if (!dayData) return []
    return Array.from(new Set(dayData.requests.map(r => r.type)))
  }, [dayData])

  const statusCounts = useMemo(() => {
    if (!dayData) return { approved: 0, pending: 0, rejected: 0 }
    return dayData.requests.reduce((acc, req) => {
      const status = req.status.toLowerCase()
      if (status === 'approved') acc.approved++
      else if (status === 'pending') acc.pending++
      else if (status === 'rejected') acc.rejected++
      return acc
    }, { approved: 0, pending: 0, rejected: 0 })
  }, [dayData])

  if (!dayData) return null

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 overflow-y-auto"
          onClick={onClose}
          style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-white rounded-3xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden border border-white/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-8">
              {/* Header Info */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-3xl font-black text-gray-900 leading-tight">
                    {format(dayData.date, "EEEE", { locale: es }).charAt(0).toUpperCase() + format(dayData.date, "EEEE", { locale: es }).slice(1)}
                  </h2>
                  <p className="text-[#33b150] font-bold text-lg">
                    {format(dayData.date, "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
                <div className="bg-[#f0faf2] border border-[#d1f2d9] rounded-2xl px-6 py-3">
                  <span className="text-2xl font-black text-[#33b150]">{dayData.count}</span>
                  <span className="ml-2 text-sm font-bold text-[#33b150] uppercase tracking-wider">Solicitudes</span>
                </div>
              </div>

              {/* Filter Controls Simplified with Counts Above */}
              <div className="flex flex-wrap gap-x-4 gap-y-6 mb-8">
                <div className="flex flex-col items-center">
                  <span className={`text-xs font-black mb-1 transition-colors ${filterType === "all" ? "text-[#33b150]" : "text-gray-300"}`}>
                    {dayData.count}
                  </span>
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${filterType === "all"
                      ? "bg-[#33b150] text-white shadow-lg shadow-emerald-500/20"
                      : "bg-white border-2 border-gray-100 text-gray-400 hover:border-emerald-200"
                      }`}
                  >
                    Todas
                  </button>
                </div>
                {uniqueTypes.map(type => (
                  <div key={type} className="flex flex-col items-center">
                    <span className={`text-xs font-black mb-1 transition-colors ${filterType === type ? "text-[#33b150]" : "text-gray-300"}`}>
                      {typeStats[type]?.count || 0}
                    </span>
                    <button
                      onClick={() => setFilterType(type)}
                      className={`px-5 py-2 rounded-xl text-sm font-black transition-all ${filterType === type
                        ? "bg-[#33b150] text-white shadow-lg shadow-emerald-500/20"
                        : "bg-white border-2 border-gray-100 text-gray-400 hover:border-emerald-200"
                        }`}
                    >
                      {getTypeName(type)}
                    </button>
                  </div>
                ))}
              </div>

              {/* Tab Content */}
              {/* Requests List */}
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {filteredRequests.map((request, index) => (
                  <motion.div
                    key={request.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#33b150]/30 hover:bg-[#f0faf2]/30 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-[#f0faf2] rounded-xl flex items-center justify-center text-[#33b150]">
                          {getTypeIcon(request.type)}
                        </div>
                        <div>
                          <h4 className="text-lg font-black text-gray-900">{request.name.toUpperCase()}</h4>
                          <p className="text-xs font-bold text-gray-400 tracking-wider">
                            CÓDIGO: {request.code || request.codeAM || request.codePM || '---'} • {getTypeName(request.type)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[10px] font-black px-3 py-1 rounded-full border-2 uppercase tracking-tighter ${request.status === 'approved' ? 'bg-[#f0faf2] text-[#33b150] border-[#d1f2d9]' : 'bg-gray-50 text-gray-400 border-gray-100'}`}>
                          {getStatusText(request.status)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {filteredRequests.length === 0 && (
                  <div className="text-center py-20">
                    <p className="text-gray-400 font-bold">No hay solicitudes para mostrar</p>
                  </div>
                )}
              </div>
            </div>

            {/* Simple Footer */}
            <div className="border-t border-gray-50 p-6 bg-white">
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-10 py-3 rounded-xl font-black bg-[#33b150] hover:bg-[#2d9e47] text-white shadow-lg transition-all"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return typeof window !== 'undefined' ? createPortal(modalContent, document.body) : null
}


const WeeklyStats = React.memo(({ requests }: WeeklyStatsProps) => {

  const { userContext } = useRBACContext()
  const currentUserType = userContext?.userType

  const generateGlobalDayData = useCallback(() => {
    const requestsByDate: Record<string, Request[]> = {}

    let filteredRequests = requests
    if (currentUserType === 'se_maintenance') {
      filteredRequests = requests.filter(request => (request as any).userType === 'se_maintenance')
    } else if (currentUserType && currentUserType !== 'se_maintenance') {
      filteredRequests = requests.filter(request => (request as any).userType !== 'se_maintenance')
    }

    filteredRequests.forEach((request) => {
      if (request.dates) {
        const datesArray = typeof request.dates === "string" ? request.dates.split(",") : request.dates
        datesArray.forEach((dateStr: string) => {
          let dateKey = dateStr.trim()

          if (dateKey.includes('/')) {
            const parts = dateKey.split('/');
            if (parts.length === 3) {
              dateKey = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }

          if (dateKey) {
            // Force reliable parsing by appending time to ensure local interpretation if needed, 
            // but actually standard yyyy-mm-dd is best kept as string key.
            // We just need to validate it's date-like.
            const dateObj = new Date(`${dateKey}T12:00:00`);

            if (!isNaN(dateObj.getTime())) {
              const standardizedKey = format(dateObj, 'yyyy-MM-dd');
              if (!requestsByDate[standardizedKey]) {
                requestsByDate[standardizedKey] = []
              }
              requestsByDate[standardizedKey].push(request)
            }
          }
        })
      }
    })

    const allDaysData = Object.keys(requestsByDate)
      .map((dateKey) => {
        // dateKey is strictly 'yyyy-MM-dd'
        const date = new Date(`${dateKey}T12:00:00`);

        return {
          day: format(date, 'dd'),
          date: date,
          dayName: format(date, "EEEE", { locale: es }),
          count: requestsByDate[dateKey].length,
          requests: requestsByDate[dateKey],
          dateKey: dateKey,
        }
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    return allDaysData
  }, [requests, currentUserType])

  const allDaysData = useMemo(() => generateGlobalDayData(), [generateGlobalDayData])

  const weeklyData = useMemo(() => {
    const weekMap: Record<string, { weekNumber: number; year: number; days: typeof allDaysData; startDate: Date; endDate: Date }> = {}

    const registerWeek = (date: Date) => {
      const weekStart = startOfWeek(date, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(date, { weekStartsOn: 1 })
      const weekNumber = getWeek(date, { weekStartsOn: 1 })
      // Use year of the week start to avoid end-of-year crossover confusion in keys
      const weekKey = `${format(weekStart, 'yyyy')}-W${String(weekNumber).padStart(2, "0")}`;

      if (!weekMap[weekKey]) {
        weekMap[weekKey] = {
          weekNumber,
          year: parseInt(format(weekStart, 'yyyy')),
          days: [],
          startDate: weekStart,
          endDate: weekEnd,
        }
      }
      return weekKey;
    }

    // 1. Ensure CURRENT WEEK always exists
    registerWeek(new Date());

    // 2. Register weeks from data
    allDaysData.forEach(dayData => {
      registerWeek(dayData.date);
    })

    // 3. Fill days
    Object.keys(weekMap).forEach(weekKey => {
      const week = weekMap[weekKey]
      const fullWeekDays: typeof allDaysData = []

      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(week.startDate);
        currentDate.setDate(week.startDate.getDate() + i);
        // Normalize time to noon to avoiding midnight boundary shift issues
        currentDate.setHours(12, 0, 0, 0);

        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const existingDay = allDaysData.find(d => d.dateKey === dateKey)

        if (existingDay) {
          fullWeekDays.push(existingDay)
        } else {
          fullWeekDays.push({
            day: format(currentDate, 'dd'),
            date: currentDate,
            dayName: format(currentDate, "EEEE", { locale: es }),
            count: 0,
            requests: [],
            dateKey: dateKey,
          })
        }
      }
      week.days = fullWeekDays.sort((a, b) => a.date.getTime() - b.date.getTime());
    })

    return weekMap
  }, [allDaysData])

  const sortedWeeklyData = useMemo(() => {
    return Object.entries(weeklyData).sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
  }, [weeklyData])

  const [currentWeekIndex, setCurrentWeekIndex] = useState(0)
  const [selectedDay, setSelectedDay] = useState<typeof allDaysData[0] | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleDayClick = useCallback((day: typeof allDaysData[0]) => {
    if (day.count > 0) {
      setSelectedDay(day)
      setIsModalOpen(true)
    }
  }, [])

  // Default to Showing Today's week
  useEffect(() => {
    if (sortedWeeklyData.length > 0) {
      const todayKey = format(new Date(), 'yyyy-MM-dd');
      const todayIndex = sortedWeeklyData.findIndex(([key, week]) => {
        const start = format(week.startDate, 'yyyy-MM-dd');
        const end = format(week.endDate, 'yyyy-MM-dd');
        return todayKey >= start && todayKey <= end;
      });

      if (todayIndex !== -1) {
        setCurrentWeekIndex(todayIndex);
      } else {
        setCurrentWeekIndex(0);
      }
    }
  }, [sortedWeeklyData]);

  // Removiendo redundancia con el useEffect de abajo que ya maneja esto mejor
  const navigateWeeks = useCallback(
    (newDirection: number) => {
      const newIndex = currentWeekIndex + newDirection
      if (newIndex >= 0 && newIndex < sortedWeeklyData.length) {
        setCurrentWeekIndex(newIndex)
      }
    },
    [currentWeekIndex, sortedWeeklyData],
  )

  const currentWeek = sortedWeeklyData[currentWeekIndex]?.[1];

  if (!currentWeek) return null;

  const maxCount = Math.max(...currentWeek.days.map(d => d.count), 5); // Minimum scale of 5 for visual balance

  return (
    <div className="space-y-4">
      <Card className="bg-white rounded-3xl shadow-[0_2px_20px_rgba(0,0,0,0.03)] border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeeks(1)}
            disabled={currentWeekIndex >= sortedWeeklyData.length - 1}
            className="h-9 w-9 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="text-center">
            <h4 className="text-sm font-black text-gray-900 uppercase tracking-widest">
              Semana {currentWeek.weekNumber}
            </h4>
            <p className="text-xs font-medium text-gray-500 mt-1">
              {format(currentWeek.startDate, "d MMM", { locale: es })} - {format(currentWeek.endDate, "d MMM, yyyy", { locale: es })}
            </p>
          </div>

          <Button
            variant="outline"
            size="icon"
            onClick={() => navigateWeeks(-1)}
            disabled={currentWeekIndex <= 0}
            className="h-9 w-9 rounded-xl border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-900 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-6">
          <div className="flex items-end justify-between h-48 gap-2 md:gap-4">
            {currentWeek.days.map((day, idx) => {
              const count = Number(day.count) || 0;
              const safeMax = maxCount || 5;
              const percentage = Math.min(100, Math.max(0, (count / safeMax) * 100));
              const isToday = isSameDay(day.date, new Date());

              return (
                <div key={idx} className="flex-1 flex flex-col items-center group">
                  <div className="relative w-full h-32 flex items-end justify-center mb-4">
                    {/* Cantidad arriba de la barra */}
                    {count > 0 && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#4cc253] text-white text-xs font-bold px-2 py-1 rounded-lg shadow-md z-10">
                        {count}
                      </div>
                    )}

                    {/* Unified Bar Container */}
                    <div
                      onClick={() => handleDayClick(day)}
                      className={`relative w-full md:w-16 h-full bg-gray-50 rounded-xl overflow-hidden group-hover:bg-gray-100 transition-colors ${count > 0 ? 'cursor-pointer hover:ring-2 hover:ring-[#4cc253]/30' : ''}`}
                    >
                      {/* Active Fill */}
                      {count > 0 && (
                        <div
                          style={{ height: `${Math.max(percentage, 5)}%` }} // Minimum 5% to ensure visibility
                          className="absolute bottom-0 left-0 right-0 bg-[#4cc253] rounded-t-lg transition-all duration-700 ease-out"
                        />
                      )}
                    </div>
                  </div>

                  <div className="text-center">
                    <span className={`text-[10px] font-bold uppercase tracking-wider block mb-0.5 ${isToday ? "text-[#4cc253]" : "text-gray-400"}`}>
                      {day.dayName.substring(0, 3)}
                    </span>
                    <span className={`text-xs font-bold block ${isToday ? "text-gray-900 bg-[#4cc253]/10 px-2 py-0.5 rounded-md" : "text-gray-900"}`}>
                      {day.day}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <DayModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        dayData={selectedDay}
      />
    </div>


  )
})

WeeklyStats.displayName = "WeeklyStats"

export default WeeklyStats