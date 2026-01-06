"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "@/components/ui/use-toast"
import useUserData from "../hooks/useUserData"
import BottomNavigation from "@/components/BottomNavigation"
import {
  FileText,
  ChevronRight,
  Briefcase,
  CheckCircle,
  AlertCircle,
  X,
  Search,
} from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { VisuallyHidden } from "@radix-ui/react-visually-hidden"
import { Button } from "@/components/ui/button"
import { SuccessMessage } from "../../components/SuccessMessage"

// Importar módulos refactorizados
import { UserInfoCard } from "./components/UserInfoCard"
import { NoveltyTypeDialog, SubpoliticaDialog } from "./components/NoveltyDialogs"
import { useConnectionAwareSubmit } from "./hooks/useConnectionAwareSubmit"
import { submitPermitRequest, checkExistingPermits, updateUserPhone, getUserPermits } from "./api-service"
import {
  getCalendarDatesWithHolidays,
  getFixedRangeDates,
  getExtemporaneousDates,
  getTodayDateInfo
} from "./utils"
import { validateFile, createFileWithInfo } from "./file-utils"
import { FileWithInfo, UserPermit } from "./types"
import { MAINTENANCE_NOVELTY_OPTIONS, REGULAR_NOVELTY_OPTIONS, SUBPOLITICAS_DATA } from "./constants"
import { groupSubpoliticas, filterGroupedSubpoliticas } from "./subpoliticas-utils"

/**
 * Página principal de solicitud de permisos - Versión refactorizada
 * 
 * Este componente ahora es mucho más limpio y manejable gracias a la
 * separación en módulos especializados:
 * - types.ts: Tipos e interfaces
 * - utils.ts: Funciones utilitarias de fechas
 * - api-service.ts: Servicios de API
 * - file-utils.ts: Manejo de archivos
 * - hooks/: Hooks personalizados
 * - components/: Componentes reutilizables
 * - animations.ts: Variantes de animación
 */
export default function SolicitudPermisosPage() {
  const router = useRouter()
  const { userData, isLoading: isLoadingUser } = useUserData()

  // Estados principales
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [description, setDescription] = useState("")
  const [selectedFiles, setSelectedFiles] = useState<FileWithInfo[]>([])
  const [noveltyType, setNoveltyType] = useState<string>("")
  const [hasNewNotification, setHasNewNotification] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Estados de UI
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false)
  const [phoneInput, setPhoneInput] = useState("")

  // Estados para diálogos de tipo de novedad
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [selectedSubpolitica, setSelectedSubpolitica] = useState("")
  const [isSubpoliticaDialogOpen, setIsSubpoliticaDialogOpen] = useState(false)
  const [subpoliticaSearchTerm, setSubpoliticaSearchTerm] = useState("")

  // Estados para validación de fechas existentes
  const [userPermits, setUserPermits] = useState<UserPermit[]>([])
  const [selectedExistingPermit, setSelectedExistingPermit] = useState<UserPermit | null>(null)
  const [isExistingDialogOpen, setIsExistingDialogOpen] = useState(false)

  // Hook de envío con reintentos
  const { submit, state: submitState } = useConnectionAwareSubmit(
    submitPermitRequest,
    {
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000,
      deduplicationWindow: 5000,
      onProgress: (stage) => {
        console.log("Progreso:", stage)
      },
      onConnectionIssue: (issue) => {
        toast({
          title: "Problema de conexión",
          description: issue,
          variant: "destructive",
        })
      },
    }
  )

  // Cargar fechas del calendario
  const { regularDates: initialRegularDates, upcomingHolidays } = getCalendarDatesWithHolidays()

  const regularDates = useMemo(() => {
    if (noveltyType === 'calamidad') {
      const today = getTodayDateInfo()
      if (!initialRegularDates.some((d) => d.formattedDate === today.formattedDate)) {
        return [today, ...initialRegularDates]
      }
    }
    return initialRegularDates
  }, [noveltyType, initialRegularDates])

  // Cargar permisos existentes del usuario
  const fetchPermits = async () => {
    const permits = await getUserPermits()
    setUserPermits(permits)
  }

  useEffect(() => {
    fetchPermits()
  }, [])

  // Manejar selección de fechas
  const handleDateSelect = (date: string) => {
    const existingPermit = userPermits.find((p) => p.fecha === date)
    if (existingPermit) {
      setSelectedExistingPermit(existingPermit)
      setIsExistingDialogOpen(true)
      return
    }

    setSelectedDates((prev) => {
      if (prev.includes(date)) {
        return prev.filter((d) => d !== date)
      }
      return [...prev, date]
    })
  }

  // Manejar carga de archivos
  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles: FileWithInfo[] = []

    for (const file of fileArray) {
      const error = validateFile(file)
      if (error) {
        toast({
          title: "Error de archivo",
          description: error,
          variant: "destructive",
        })
        continue
      }

      const fileWithInfo = await createFileWithInfo(file)
      validFiles.push(fileWithInfo)
    }

    setSelectedFiles((prev) => [...prev, ...validFiles])
  }

  // Manejar envío del formulario
  const handleSubmit = async () => {
    if (!noveltyType) {
      toast({
        title: "Error",
        description: "Debes seleccionar un tipo de novedad",
        variant: "destructive",
      })
      return
    }

    if (selectedDates.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos una fecha",
        variant: "destructive",
      })
      return
    }

    if (!description.trim()) {
      // Si la descripción no es obligatoria según el usuario, 
      // podrías dejarla así o poner un valor por defecto si la API lo requiere.
      // Pero mantengo la validación por si acaso, o la quito si prefieres.
    }

    // Verificar permisos existentes
    const hasExisting = await checkExistingPermits(selectedDates, noveltyType)
    if (hasExisting) {
      toast({
        title: "Permiso duplicado",
        description: "Ya existe un permiso para estas fechas",
        variant: "destructive",
      })
      return
    }

    // Preparar FormData con los campos requeridos por el backend
    const formData = new FormData()
    formData.append("code", userData?.code || "")
    formData.append("name", userData?.name || "")
    formData.append("dates", JSON.stringify(selectedDates))
    formData.append("description", description)
    formData.append("noveltyType", noveltyType)

    selectedFiles.forEach((fileInfo) => {
      formData.append("files", fileInfo.file)
    })

    try {
      await submit(formData as any)

      setIsSuccess(true)

      // Limpiar formulario se maneja antes o después, pero aquí está bien
      setSelectedDates([])
      setDescription("")
      setSelectedFiles([])

      // Refrescar permisos
      await fetchPermits()

      // Redirigir después de mostrar el mensaje de éxito
      setTimeout(() => {
        setIsSuccess(false)
        router.push("/dashboard")
      }, 3000)
    } catch (error) {
      console.error("Error al enviar solicitud:", error)
    }
  }

  // Manejar actualización de teléfono
  const handlePhoneUpdate = async () => {
    try {
      await updateUserPhone(phoneInput)
      toast({
        title: "Éxito",
        description: "Teléfono actualizado correctamente",
      })
      setIsPhoneModalOpen(false)
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo actualizar el teléfono",
        variant: "destructive",
      })
    }
  }

  // Obtener opciones de novedad según el tipo de usuario  
  const noveltyOptions = userData?.userType === "se_maintenance"
    ? MAINTENANCE_NOVELTY_OPTIONS
    : REGULAR_NOVELTY_OPTIONS

  // Agrupar subpolíticas
  const groupedSubpoliticas = useMemo(() => groupSubpoliticas(), [])

  // Filtrar subpolíticas según término de búsqueda
  const filteredGroupedSubpoliticas = useMemo(
    () => filterGroupedSubpoliticas(groupedSubpoliticas, subpoliticaSearchTerm),
    [groupedSubpoliticas, subpoliticaSearchTerm]
  )

  // Label e icono seleccionado
  const selectedNoveltyLabel = noveltyType === "subpolitica"
    ? selectedSubpolitica
    : noveltyOptions.find((option) => option.id === noveltyType)?.label || "Seleccione el tipo de novedad"
  const selectedNoveltyIcon = noveltyType === "subpolitica"
    ? Briefcase
    : noveltyOptions.find((option) => option.id === noveltyType)?.icon || FileText

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#4cc253] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Cargando información...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="container mx-auto max-w-7xl px-4 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Solicitud de Permisos</h1>
            <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">
              Nueva Solicitud
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto max-w-4xl px-4 py-8 space-y-6">
        {/* User Info Card */}
        <UserInfoCard
          code={userData?.code}
          name={userData?.name}
          phone={userData?.phone}
          onPhoneEdit={() => {
            setPhoneInput(userData?.phone || "")
            setIsPhoneModalOpen(true)
          }}
        />

        {/* Bloqueo por temporada navideña - Diseño Premium Minimalista */}
        {userData?.userType === 'registered' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="relative overflow-hidden bg-white rounded-[32px] p-8 border border-gray-100 shadow-xl shadow-gray-200/50"
          >
            {/* Elementos decorativos sutiles */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-full -mr-16 -mt-16 opacity-50" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-green-50 rounded-full -ml-12 -mb-12 opacity-50" />

            <div className="relative flex flex-col items-center text-center space-y-6">
              <div className="flex -space-x-2">
                <div className="bg-red-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-red-200 rotate-[-10deg]">
                  <span className="text-xl">🎄</span>
                </div>
                <div className="bg-white w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-gray-50 z-10">
                  <span className="text-xl">✨</span>
                </div>
                <div className="bg-[#4cc253] w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-green-200 rotate-[10deg]">
                  <span className="text-xl">🎁</span>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Vacaciones de Navidad</h3>
                <div className="h-1 w-12 bg-[#4cc253] mx-auto rounded-full" />
              </div>

              <div className="space-y-4">
                <p className="text-gray-600 font-medium leading-relaxed max-w-sm mx-auto">
                  Te deseamos unas <span className="text-red-500 font-bold">felices fiestas</span>. Disfruta de este tiempo especial en familia con mucho amor y alegría.
                </p>

                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 inline-block">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Retorno de actividades</p>
                  <p className="text-gray-900 font-black">12 de Enero, 2026</p>
                </div>
              </div>

              <p className="text-[11px] font-bold text-gray-400 italic">
                El sistema de solicitudes se encuentra pausado temporalmente.
              </p>
            </div>
          </motion.div>
        )}

        {/* Tipo de Novedad */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={`bg-white rounded-3xl p-6 border border-gray-100 shadow-sm ${userData?.userType === 'registered' ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h3 className="text-xs uppercase font-black text-gray-400 tracking-[0.2em] mb-3">
            Tipo de Novedad <span className="text-red-500">*</span>
          </h3>
          <button
            type="button"
            onClick={() => setIsTypeDialogOpen(true)}
            className="w-full flex items-center justify-between p-4 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-[#4cc253]/5 hover:border-[#4cc253]/30 transition-all group"
          >
            <div className="flex items-center">
              {noveltyType ? (
                <>
                  <div className="bg-[#4cc253]/10 p-2.5 rounded-xl mr-3">
                    {React.createElement(selectedNoveltyIcon, { className: "h-5 w-5 text-[#4cc253]" })}
                  </div>
                  <span className="font-bold text-gray-900">{selectedNoveltyLabel}</span>
                </>
              ) : (
                <>
                  <div className="bg-gray-100 p-2.5 rounded-xl mr-3 group-hover:bg-[#4cc253]/10 transition-colors">
                    <FileText className="h-5 w-5 text-gray-500 group-hover:text-[#4cc253] transition-colors" />
                  </div>
                  <span className="text-gray-500 font-medium group-hover:text-gray-700 transition-colors">
                    Seleccione el tipo de novedad
                  </span>
                </>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-[#4cc253]/60 group-hover:text-[#4cc253] transition-colors" />
          </button>
        </motion.div>

        {/* Calendario de Fechas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={`bg-white rounded-3xl p-6 border border-gray-100 shadow-sm ${userData?.userType === 'registered' ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-xl font-black text-gray-900 mb-6 uppercase tracking-tighter">
            Selecciona las Fechas <span className="text-red-500">*</span>
          </h2>

          <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
            {regularDates.map((dateInfo) => {
              const isSelected = selectedDates.includes(dateInfo.formattedDate)
              const isHoliday = upcomingHolidays.some((h) =>
                h.toDateString() === dateInfo.date.toDateString()
              )
              const isAlreadyRequested = userPermits.some((p) => p.fecha === dateInfo.formattedDate)

              return (
                <button
                  key={dateInfo.formattedDate}
                  onClick={() => handleDateSelect(dateInfo.formattedDate)}
                  disabled={isAlreadyRequested || userData?.userType === 'registered'}
                  className={`
                    py-3 px-1 md:py-4 rounded-2xl border-2 transition-all relative overflow-hidden min-w-[70px]
                    ${isSelected
                      ? "bg-[#4cc253] text-white border-[#4cc253]"
                      : isAlreadyRequested
                        ? "bg-gray-200 border-gray-300 text-gray-500 cursor-not-allowed opacity-80"
                        : "bg-gray-50 border-gray-100 text-gray-900 hover:border-[#4cc253]/50 shadow-sm"
                    }
                  `}
                >
                  <div className={`flex flex-col items-center justify-center ${isAlreadyRequested ? 'grayscale' : ''}`}>
                    <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-tight mb-0.5 
                      ${isSelected ? 'text-white/80' : isAlreadyRequested ? 'text-gray-500' : 'text-[#4cc253]'}`}>
                      {dateInfo.dayName.slice(0, 3)}
                    </p>
                    <p className="text-xl md:text-2xl font-black leading-none">{dateInfo.dayNumber}</p>
                    {isAlreadyRequested ? (
                      <p className="text-[7px] md:text-[8px] font-black uppercase tracking-tighter mt-1 text-gray-400">
                        Ya enviada
                      </p>
                    ) : (
                      <p className={`text-[8px] md:text-[9px] font-black uppercase tracking-tighter mt-1 
                        ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                        {dateInfo.monthName.slice(0, 3)} {dateInfo.year}
                      </p>
                    )}
                  </div>
                  {isAlreadyRequested && (
                    <div className="absolute top-1 right-1">
                      <CheckCircle className="h-3 w-3 text-[#4cc253]" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Advertencia de múltiples fechas */}
          <AnimatePresence>
            {selectedDates.length >= 2 && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 24 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                  <div className="bg-amber-100 p-2 rounded-xl">
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  </div>
                  <p className="text-sm font-bold text-amber-800">
                    Este permiso será tomado como <span className="underline">Licencia No Remunerada</span> al seleccionar dos o más fechas.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Descripción */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className={`bg-white rounded-3xl p-6 border border-gray-100 shadow-sm ${userData?.userType === 'registered' ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-xl font-black text-gray-900 mb-4 uppercase tracking-tighter">
            Descripción
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={userData?.userType === 'registered'}
            placeholder="Describe el motivo de tu solicitud..."
            className="w-full min-h-[150px] p-4 border border-gray-100 rounded-2xl focus:border-[#4cc253] focus:ring-2 focus:ring-[#4cc253]/20 resize-none"
          />
        </motion.div>

        {/* Botón de envío */}
        <button
          onClick={handleSubmit}
          disabled={submitState.isSubmitting || !noveltyType || selectedDates.length === 0 || userData?.userType === 'registered'}
          className="w-full h-14 rounded-2xl bg-[#4cc253] hover:bg-[#3da343] text-white font-black uppercase tracking-widest text-xs shadow-lg disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed transition-all"
        >
          {userData?.userType === 'registered' ? "Sistema no disponible" : (submitState.isSubmitting ? "Enviando..." : "Enviar Solicitud")}
        </button>
      </div>

      {/* Diálogos de selección de tipo de novedad */}
      <NoveltyTypeDialog
        isOpen={isTypeDialogOpen}
        onClose={() => setIsTypeDialogOpen(false)}
        noveltyOptions={noveltyOptions}
        noveltyType={noveltyType}
        onSelectType={(typeId) => {
          setNoveltyType(typeId)
          setSelectedDates([])
        }}
        onOpenSubpoliticaDialog={() => setIsSubpoliticaDialogOpen(true)}
      />

      <SubpoliticaDialog
        isOpen={isSubpoliticaDialogOpen}
        onClose={() => setIsSubpoliticaDialogOpen(false)}
        onBack={() => setIsTypeDialogOpen(true)}
        filteredGroupedsubpoliticas={filteredGroupedSubpoliticas}
        selectedSubpolitica={selectedSubpolitica}
        onSelectSubpolitica={(subpolitica) => {
          setSelectedSubpolitica(subpolitica)
          setNoveltyType("subpolitica")
          setSelectedDates([])
        }}
        searchTerm={subpoliticaSearchTerm}
        onSearchChange={setSubpoliticaSearchTerm}
      />

      {/* Diálogo de Solicitud Existente */}
      <Dialog open={isExistingDialogOpen} onOpenChange={setIsExistingDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-[32px] border-0 outline-none">
          <VisuallyHidden>
            <DialogHeader>
              <DialogTitle>Día ya solicitado</DialogTitle>
              <DialogDescription>Detalles de la solicitud existente para esta fecha.</DialogDescription>
            </DialogHeader>
          </VisuallyHidden>

          <div className="bg-[#4cc253] p-8 text-center relative">
            <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <CheckCircle className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight leading-none">Día ya solicitado</h2>
            <p className="text-white/80 text-sm font-bold uppercase tracking-widest mt-2">Información de tu solicitud</p>
            <button
              onClick={() => setIsExistingDialogOpen(false)}
              className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 rounded-full transition-colors text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-8 space-y-6">
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tipo de Novedad</p>
                <p className="text-lg font-black text-gray-900 leading-tight">{selectedExistingPermit?.tipo_novedad}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Fecha</p>
                  <p className="font-bold text-gray-900">{selectedExistingPermit?.fecha}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Estado</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${selectedExistingPermit?.status === 'approved' ? 'bg-[#4cc253]' : selectedExistingPermit?.status === 'pending' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <p className={`font-bold uppercase text-[10px] ${selectedExistingPermit?.status === 'approved' ? 'text-[#4cc253]' : selectedExistingPermit?.status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>
                      {selectedExistingPermit?.status === 'approved' ? 'Aprobada' : selectedExistingPermit?.status === 'pending' ? 'Pendiente' : 'Rechazada'}
                    </p>
                  </div>
                </div>
              </div>

              {selectedExistingPermit?.description && (
                <div className="p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Tu Descripción</p>
                  <p className="text-sm text-gray-600 italic">"{selectedExistingPermit.description}"</p>
                </div>
              )}

              {selectedExistingPermit?.respuesta && (
                <div className="p-4 bg-[#4cc253]/5 rounded-2xl border border-[#4cc253]/20">
                  <p className="text-[10px] font-black text-[#4cc253] uppercase tracking-widest mb-1">Respuesta del Supervisor</p>
                  <p className="text-sm text-[#4cc253] font-medium">{selectedExistingPermit.respuesta}</p>
                </div>
              )}
            </div>

            <Button
              onClick={() => setIsExistingDialogOpen(false)}
              className="w-full h-14 rounded-2xl bg-[#4cc253] hover:bg-[#3da343] text-white font-black uppercase tracking-widest text-xs shadow-lg transition-all"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <SuccessMessage
        isVisible={isSuccess}
        onClose={() => setIsSuccess(false)}
      />

      {/* Bottom Navigation */}
      <BottomNavigation hasNewNotification={hasNewNotification} />
    </div>
  )
}
