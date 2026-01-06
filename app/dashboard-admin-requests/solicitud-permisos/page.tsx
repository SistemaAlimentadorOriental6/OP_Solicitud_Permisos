"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  User,
  Car,
  Phone,
  Calendar,
  Clock,
  FileText,
  AlertCircle,
  Briefcase,
  Loader2,
  CheckCircle,
  Info,
  ChevronRight,
  Sun,
  HeartPulse,
  Table2,
  Moon,
  X
} from "lucide-react"
import { format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "@/components/ui/use-toast"
import { useRouter } from "next/navigation"

import useUserData from "../../hooks/useUserData"
import { AdminUserInfoCard } from "./components/AdminUserInfoCard"
import { useConnectionAwareSubmit } from "@/app/solicitud-permisos/hooks/useConnectionAwareSubmit"
import { checkExistingPermits } from "@/app/solicitud-permisos/api-service"
import {
  getCalendarDatesWithHolidays,
  getFixedRangeDates,
  getExtemporaneousDates,
  formatFileSize,
  isHoliday
} from "@/app/solicitud-permisos/utils"
import { validateFile, generateFilePreview } from "@/app/solicitud-permisos/file-utils"
import { DateInfo, FileWithInfo } from "@/app/solicitud-permisos/types"
import {
  MAINTENANCE_NOVELTY_OPTIONS,
  REGULAR_NOVELTY_OPTIONS,
  SUBPOLITICAS_DATA
} from "@/app/solicitud-permisos/constants"

interface PermitRequestFormProps {
  isExtemporaneous?: boolean
}

export default function PermitRequestForm({ isExtemporaneous = false }: PermitRequestFormProps) {
  const router = useRouter()
  const { userData, isLoading, error, fetchUserData } = useUserData()

  const [actualIsExtemporaneous, setActualIsExtemporaneous] = useState(isExtemporaneous)
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [noveltyType, setNoveltyType] = useState("")
  const [selectedDates, setSelectedDates] = useState<Date[]>([])
  const [isPhoneDialogOpen, setIsPhoneDialogOpen] = useState(false)
  const [newPhoneNumber, setNewPhoneNumber] = useState("")
  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false)
  const [isLicenseNotificationOpen, setIsLicenseNotificationOpen] = useState(false)
  const [hasShownLicenseNotification, setHasShownLicenseNotification] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [isTypeDialogOpen, setIsTypeDialogOpen] = useState(false)
  const [selectedSubpolitica, setSelectedSubpolitica] = useState("")
  const [isSubpoliticaDialogOpen, setIsSubpoliticaDialogOpen] = useState(false)
  const [subpoliticaSearchTerm, setSubpoliticaSearchTerm] = useState("")

  const [uploadedFiles, setUploadedFiles] = useState<FileWithInfo[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  const phoneInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [weekDates, setWeekDates] = useState<DateInfo[]>([])
  const [existingPermitDates, setExistingPermitDates] = useState<string[]>([])
  const [fechasEnviadasUsuario, setFechasEnviadasUsuario] = useState<string[]>([])
  const [cargandoFechasExistentes, setCargandoFechasExistentes] = useState(false)
  const [timeValue, setTimeValue] = useState("")
  const [descriptionValue, setDescriptionValue] = useState("")

  const MAX_FILES = 5

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const urlExtemporaneous = urlParams.get('extemporaneous') === 'true'
    const navigationContext = localStorage.getItem('navigationContext')
    const contextExtemporaneous = navigationContext === 'extemporaneous'
    const referrer = document.referrer
    const referrerExtemporaneous = referrer.includes('extemporaneous') || referrer.includes('dashboard-admin')
    const titleExtemporaneous = document.title.includes('Extemporáneos') ||
      document.querySelector('h1')?.textContent?.includes('Extemporáneos') ||
      document.querySelector('[class*="title"]')?.textContent?.includes('Extemporáneos')
    const isMaintenanceUser = userData?.userType === 'se_maintenance'

    const shouldBeExtemporaneous = isExtemporaneous || urlExtemporaneous || contextExtemporaneous ||
      referrerExtemporaneous || titleExtemporaneous || isMaintenanceUser

    setActualIsExtemporaneous(shouldBeExtemporaneous)
  }, [isExtemporaneous, userData])

  const handleFileUpload = async (files: FileList | File[]) => {
    const fileArray = Array.from(files)

    if (uploadedFiles.length + fileArray.length > MAX_FILES) {
      setErrorMessage(`Solo se pueden cargar hasta ${MAX_FILES} archivos. Actualmente tienes ${uploadedFiles.length} archivo(s).`)
      setIsErrorModalOpen(true)
      return
    }

    const newFiles: FileWithInfo[] = []

    for (const file of fileArray) {
      const fileId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const validationError = validateFile(file)

      if (validationError) {
        newFiles.push({
          file,
          id: fileId,
          error: validationError,
          isUploading: false,
          uploadStatus: "error",
          fileSize: formatFileSize(file.size),
          fileType: file.type || "unknown",
        })
      } else {
        try {
          const preview = await generateFilePreview(file)
          newFiles.push({
            file,
            id: fileId,
            preview,
            isUploading: false,
            uploadStatus: "pending",
            uploadProgress: 0,
            fileSize: formatFileSize(file.size),
            fileType: file.type || "unknown",
          })
        } catch (error) {
          newFiles.push({
            file,
            id: fileId,
            error: `Error al procesar el archivo "${file.name}"`,
            isUploading: false,
            uploadStatus: "error",
            fileSize: formatFileSize(file.size),
            fileType: file.type || "unknown",
          })
        }
      }
    }

    setUploadedFiles((prev) => [...prev, ...newFiles])

    const validFiles = newFiles.filter((f) => !f.error).length
    const errorFiles = newFiles.filter((f) => f.error).length

    if (validFiles > 0) {
      toast({
        title: "Archivos cargados",
        description: `${validFiles} archivo(s) cargado(s) exitosamente${errorFiles > 0 ? `, ${errorFiles} con errores` : ""}`,
        variant: errorFiles > 0 ? "destructive" : "default",
      })
    }
  }

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev.find((f) => f.id === fileId)
      if (fileToRemove?.preview && fileToRemove.preview.startsWith("data:")) {
        URL.revokeObjectURL(fileToRemove.preview)
      }
      return prev.filter((f) => f.id !== fileId)
    })
  }

  const clearAllFiles = () => {
    setUploadedFiles((prev) => {
      prev.forEach((fileInfo) => {
        if (fileInfo.preview && fileInfo.preview.startsWith("data:")) {
          URL.revokeObjectURL(fileInfo.preview)
        }
      })
      return []
    })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const openFileSelector = () => fileInputRef.current?.click()

  const checkConnectivity = async (): Promise<boolean> => {
    try {
      await fetch("/api/health", { method: "HEAD", mode: "no-cors" })
      return true
    } catch {
      return false
    }
  }

  const validateFilesBeforeSubmit = useCallback(async (): Promise<boolean> => {
    const filesWithErrors = uploadedFiles.filter((f) => f.error)
    const validFiles = uploadedFiles.filter((f) => !f.error)

    if (filesWithErrors.length > 0) {
      setErrorMessage("Hay archivos con errores que deben ser corregidos antes de enviar la solicitud.")
      setIsErrorModalOpen(true)
      return false
    }

    const totalSize = validFiles.reduce((sum, f) => sum + f.file.size, 0)
    const largeFileThreshold = 5 * 1024 * 1024

    if (totalSize > largeFileThreshold) {
      const isConnected = await checkConnectivity()
      if (!isConnected) {
        setErrorMessage("Se detectó un problema de conectividad. Los archivos son grandes y requieren una conexión estable.")
        setIsErrorModalOpen(true)
        return false
      }
    }

    return true
  }, [uploadedFiles])

  useEffect(() => {
    if (noveltyType !== "cita" && noveltyType !== "audiencia") {
      clearAllFiles()
    }
  }, [noveltyType])

  useEffect(() => clearAllFiles, [])

  const handleProgress = useCallback((stage: string) => { }, [])
  const handleConnectionIssue = useCallback((issue: string) => {
    toast({
      title: "Problema de conexión",
      description: issue,
      variant: "destructive",
    })
  }, [])

  const submitFunction = useCallback(async (data: any, signal: AbortSignal) => {
    const response = await fetch("/api/permits/permit-request", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.token}` },
      body: data.formData,
      signal,
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`Error al enviar la solicitud: ${errorData.detail || response.statusText}`)
    }
    return response.json()
  }, [])

  const connectionAwareSubmit = useConnectionAwareSubmit(submitFunction, {
    timeout: 45000,
    maxRetries: 3,
    retryDelay: 3000,
    deduplicationWindow: 8000,
    onProgress: handleProgress,
    onConnectionIssue: handleConnectionIssue,
  })

  useEffect(() => {
    const { regularDates } = actualIsExtemporaneous ? getExtemporaneousDates() : getFixedRangeDates()
    setWeekDates(regularDates)
  }, [actualIsExtemporaneous])

  const checkAllExistingPermits = useCallback(async () => {
    if (weekDates.length === 0) return

    setCargandoFechasExistentes(true)
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) return

      const allDates = weekDates.map((date) => format(date.date, "yyyy-MM-dd"))
      const hasExisting = await checkExistingPermits(allDates, noveltyType || "all", selectedEmployee?.cedula)

      // Note: The previous logic assumed checkExistingPermits returns a boolean.
      // But we need the LIST of existing dates to paint them grey.
      // The API returns { hasExistingPermit: boolean, existingDates: string[] }.
      // But my `checkExistingPermits` wrapper returns boolean.
      // Refactoring step: I might need to update the wrapper or use fetch directly here to get the list.
      // Let's us fetch directly here to preserve the "grey out dates" functionality.

      const response = await fetch("/api/permits/check-existing-permits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dates: allDates,
          noveltyType: noveltyType || "all",
          userCode: selectedEmployee?.cedula
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const fechasExistentes = data.existingDates || []
        setExistingPermitDates(fechasExistentes)
        setFechasEnviadasUsuario(fechasExistentes)
      }
    } catch {
      // warning ignored
    } finally {
      setCargandoFechasExistentes(false)
    }
  }, [noveltyType, weekDates, selectedEmployee])

  useEffect(() => {
    checkAllExistingPermits()
  }, [checkAllExistingPermits])

  useEffect(() => {
    if (weekDates.length > 0) {
      checkAllExistingPermits()
    }
  }, [weekDates])

  const handlePhoneDoubleClick = () => {
    setIsPhoneDialogOpen(true)
    setNewPhoneNumber(userData?.phone || "")
  }

  const updatePhoneNumber = async () => {
    try {
      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("No se encontró el token de acceso")

      // API call placeholder
      await new Promise((resolve) => setTimeout(resolve, 1000))
      await fetchUserData()

      setIsPhoneDialogOpen(false)
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 3000)
    } catch {
      setErrorMessage("Ocurrió un error al actualizar el número de teléfono.")
      setIsErrorModalOpen(true)
    }
  }

  const handleDateSelect = async (date: Date) => {
    if (noveltyType === "semanaAM" || noveltyType === "semanaPM") return

    const formattedDate = format(date, "yyyy-MM-dd")

    if (fechasEnviadasUsuario.includes(formattedDate)) {
      setErrorMessage(`¡Ya enviaste una solicitud para el ${format(date, "EEEE d 'de' MMMM", { locale: es })}!`)
      setIsErrorModalOpen(true)
      return
    }

    const hasExistingPermit = await checkExistingPermits([formattedDate], noveltyType, selectedEmployee?.cedula)

    if (hasExistingPermit) {
      setFechasEnviadasUsuario((prev) => [...prev, formattedDate])
      setExistingPermitDates((prev) => [...prev, formattedDate])
      setErrorMessage(`¡Ya habías seleccionado esta fecha! El ${format(date, "EEEE d 'de' MMMM", { locale: es })} ya tiene una solicitud.`)
      setIsErrorModalOpen(true)
      return
    }

    setSelectedDates((prev) => {
      const isAlreadySelected = prev.some((d) => isSameDay(d, date))
      let newDates

      if (["audiencia", "cita", "diaAM", "diaPM", "tablaPartida"].includes(noveltyType)) {
        newDates = isAlreadySelected ? [] : [date]
      } else {
        newDates = isAlreadySelected ? prev.filter((d) => !isSameDay(d, date)) : [...prev, date]

        if (newDates.length >= 2 && noveltyType === "descanso") {
          setIsConfirmationDialogOpen(true)
        }

        if (noveltyType === "licencia" && newDates.length === 3 && !hasShownLicenseNotification) {
          setIsLicenseNotificationOpen(true)
          setHasShownLicenseNotification(true)
        }
      }
      return newDates
    })
  }

  const validateSubmission = useCallback(async () => {
    if (actualIsExtemporaneous) {
      if (!selectedEmployee || !selectedEmployee.cedula || !selectedEmployee.nombre) {
        setErrorMessage("Por favor, seleccione un empleado para crear la solicitud extemporánea.")
        setIsErrorModalOpen(true)
        return false
      }
    } else {
      if (!userData || !userData.code || !userData.name) {
        setErrorMessage("Datos de usuario incompletos. Por favor, inicie sesión nuevamente.")
        setIsErrorModalOpen(true)
        return false
      }
    }

    if (!noveltyType) {
      setErrorMessage("Debe seleccionar un tipo de novedad antes de enviar.")
      setIsErrorModalOpen(true)
      return false
    }

    const requiresDates = !["semanaAM", "semanaPM"].includes(noveltyType)
    if (requiresDates && selectedDates.length === 0) {
      setErrorMessage("Debe seleccionar al menos una fecha para este tipo de solicitud.")
      setIsErrorModalOpen(true)
      return false
    }

    const filesValid = await validateFilesBeforeSubmit()
    if (!filesValid) return false

    if (["cita", "audiencia"].includes(noveltyType) && !timeValue) {
      setErrorMessage("Debe indicar la hora.")
      setIsErrorModalOpen(true)
      return false
    }
    if (["licencia", "descanso"].includes(noveltyType) && !descriptionValue.trim()) {
      setErrorMessage("Debe proporcionar una descripción.")
      setIsErrorModalOpen(true)
      return false
    }

    return true
  }, [userData, noveltyType, selectedDates, timeValue, descriptionValue, uploadedFiles, validateFilesBeforeSubmit, actualIsExtemporaneous, selectedEmployee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (connectionAwareSubmit.state.isSubmitting) return

    const isValid = await validateSubmission()
    if (!isValid) return

    try {
      const formattedDates = selectedDates.map((date) => format(date, "yyyy-MM-dd"))
      const hasExistingPermit = await checkExistingPermits(formattedDates, noveltyType, selectedEmployee?.cedula)

      if (hasExistingPermit && ["descanso", "cita", "licencia", "audiencia", "diaAM", "diaPM", "tablaPartida"].includes(noveltyType)) {
        setErrorMessage("Ya existe un permiso para una o más de las fechas seleccionadas.")
        setIsErrorModalOpen(true)
        return
      }

      const finalUserData = actualIsExtemporaneous && selectedEmployee ? {
        code: selectedEmployee.code || selectedEmployee.cedula,
        name: selectedEmployee.nombre,
        phone: userData?.phone || '',
      } : {
        code: userData?.code || userData?.cedula,
        name: userData?.name || (userData as any)?.nombre,
        phone: userData?.phone || (userData as any)?.telefono,
      }

      const dataToSend = {
        code: finalUserData.code,
        name: finalUserData.name,
        phone: finalUserData.phone,
        dates: formattedDates,
        noveltyType: noveltyType === "subpolitica" ? selectedSubpolitica : noveltyType,
        time: timeValue,
        description: descriptionValue,
      }

      if (!dataToSend.code || !dataToSend.name || !dataToSend.noveltyType) {
        setErrorMessage("Error crítico: Faltan datos esenciales.")
        setIsErrorModalOpen(true)
        return
      }

      const formData = new FormData()
      formData.append("code", dataToSend.code)
      formData.append("name", dataToSend.name)
      formData.append("phone", dataToSend.phone)
      formData.append("dates", JSON.stringify(dataToSend.dates))
      formData.append("noveltyType", dataToSend.noveltyType)
      formData.append("time", dataToSend.time)
      formData.append("description", descriptionValue)
      formData.append("autoApprove", "true")

      const validFiles = uploadedFiles.filter((fileInfo) => !fileInfo.error)

      validFiles.forEach((fileInfo, index) => {
        const fileName = `${fileInfo.file.name}`
        formData.append(`files`, fileInfo.file, fileName)
        formData.append(
          `file_metadata_${index}`,
          JSON.stringify({
            originalName: fileInfo.file.name,
            size: fileInfo.file.size,
            type: fileInfo.file.type,
            uploadTime: new Date().toISOString(),
          }),
        )
      })

      formData.append("files_summary", JSON.stringify({
        totalFiles: validFiles.length,
        totalSize: validFiles.reduce((sum, f) => sum + f.file.size, 0),
        fileTypes: validFiles.map((f) => f.file.type),
        uploadTimestamp: new Date().toISOString(),
      }))

      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("No se encontró el token de acceso")

      await connectionAwareSubmit.submit({ formData, token })

      setIsSuccess(true)
      setSelectedDates([])
      setNoveltyType("")
      setHasShownLicenseNotification(false)
      setTimeValue("")
      setDescriptionValue("")
      setUploadedFiles([])

      setTimeout(() => setIsSuccess(false), 5000)
    } catch (error) {
      setErrorMessage(`Ocurrió un error inesperado: ${error instanceof Error ? error.message : "Error desconocido"}`)
      setIsErrorModalOpen(true)
    }
  }

  const handleConfirmation = (confirmed: boolean) => {
    if (confirmed) {
      setNoveltyType("licencia")
    } else {
      setSelectedDates((prev) => prev.slice(0, -1))
    }
    setIsConfirmationDialogOpen(false)
  }

  const noveltyOptions = userData?.userType === "se_maintenance" ? MAINTENANCE_NOVELTY_OPTIONS : REGULAR_NOVELTY_OPTIONS

  const groupedSubpoliticas = SUBPOLITICAS_DATA.reduce(
    (acc, item) => {
      if (!acc[item.POLÍTICA]) acc[item.POLÍTICA] = []
      acc[item.POLÍTICA].push(item.SUBPOLÍTICA)
      return acc
    },
    {} as Record<string, string[]>
  )

  const filteredGroupedSubpoliticas = useMemo(() => {
    if (!subpoliticaSearchTerm.trim()) return groupedSubpoliticas

    const searchTerm = subpoliticaSearchTerm.toLowerCase().trim()
    const filtered: Record<string, string[]> = {}

    Object.entries(groupedSubpoliticas).forEach(([politica, subpoliticasList]) => {
      const filteredSubpoliticas = subpoliticasList.filter(subpolitica =>
        subpolitica.toLowerCase().includes(searchTerm) ||
        politica.toLowerCase().includes(searchTerm)
      )

      if (filteredSubpoliticas.length > 0) {
        filtered[politica] = filteredSubpoliticas
      }
    })

    return filtered
  }, [groupedSubpoliticas, subpoliticaSearchTerm])

  const selectedNoveltyLabel = noveltyType === "subpolitica"
    ? selectedSubpolitica
    : noveltyOptions.find((option) => option.id === noveltyType)?.label || "Seleccione el tipo de novedad"
  const selectedNoveltyIcon = noveltyType === "subpolitica"
    ? Briefcase
    : noveltyOptions.find((option) => option.id === noveltyType)?.icon || FileText

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100 flex items-center justify-center">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
          <Loader2 className="h-12 w-12 text-green-500 animate-spin" />
          <h2 className="mt-6 text-xl font-medium text-green-700">Cargando Formulario...</h2>
        </motion.div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-md text-center">
          <h2 className="text-lg font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700 mb-4">{error}</p>
          <Button onClick={() => { localStorage.removeItem("accessToken"); router.push("/") }}>
            Iniciar Sesión
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-100">
      <AnimatePresence>
        {connectionAwareSubmit.state.isSubmitting && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <Card className="bg-white/90 backdrop-blur-md border-green-100 shadow-lg overflow-hidden rounded-3xl">
            <CardHeader className="pb-2 pt-5 px-6">
              <CardTitle className="text-xl font-semibold text-green-800 flex items-center">
                <FileText className="h-6 w-6 mr-3 text-green-600" />
                Formulario de Solicitud
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <AdminUserInfoCard
                  code={userData?.code}
                  name={userData?.name}
                  phone={userData?.phone}
                  onPhoneEdit={handlePhoneDoubleClick}
                  isExtemporaneous={actualIsExtemporaneous}
                  onEmployeeSelect={(employee: any) => {
                    setSelectedEmployee(employee)
                    setSelectedDates([])
                    setNoveltyType("")
                    setDescriptionValue("")
                    setTimeValue("")
                    setUploadedFiles([])
                    setExistingPermitDates([])
                    setFechasEnviadasUsuario([])
                  }}
                  selectedEmployee={selectedEmployee}
                  userType={userData?.userType}
                />

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                  <Label className="text-green-700 font-medium flex items-center">
                    <Briefcase className="h-4 w-4 mr-2 text-green-600" />
                    Tipo de Novedad
                  </Label>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setIsTypeDialogOpen(true)}
                    className="w-full flex items-center justify-between p-4 rounded-xl border border-green-200 bg-white hover:bg-green-50 transition-colors group"
                  >
                    <div className="flex items-center">
                      <div className="bg-green-100 p-2 rounded-lg mr-3">
                        {React.createElement(selectedNoveltyIcon, { className: "h-5 w-5 text-green-600" })}
                      </div>
                      <span className="font-medium">{selectedNoveltyLabel}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-green-500" />
                  </motion.button>
                </motion.div>

                <AnimatePresence>
                  {(noveltyType === "cita" || noveltyType === "audiencia") && (
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="bg-gradient-to-r from-green-50 to-white rounded-2xl border border-green-100 shadow-lg p-6">
                      <div className="flex items-center mb-4">
                        <Clock className="h-6 w-6 mr-3 text-green-600" />
                        <h3 className="text-green-800 font-bold text-xl">Hora de la Novedad</h3>
                      </div>
                      <Input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} required className="pl-4 py-3 border-green-200" />
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.div className="bg-gradient-to-r from-green-50 to-white rounded-2xl border border-green-100 shadow-lg overflow-hidden" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <CardHeader><CardTitle className="text-green-800 font-bold text-xl flex items-center"><Calendar className="h-6 w-6 mr-3 text-green-600" />Fechas de Solicitud</CardTitle></CardHeader>
                  <CardContent>
                    {!noveltyType && <div className="text-yellow-800 bg-yellow-50 p-4 rounded-xl mb-4">Selecciona primero el tipo de novedad.</div>}
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-3">
                      {weekDates.map((item, index) => {
                        const isDateSelected = selectedDates.some((d) => isSameDay(d, item.date))
                        const isHolidayDate = isHoliday(item.date).isHoliday
                        const formattedDate = format(item.date, "yyyy-MM-dd")
                        const hasExistingPermit = existingPermitDates.includes(formattedDate)
                        const isDisabled = isHolidayDate || !noveltyType || hasExistingPermit

                        return (
                          <button
                            key={index}
                            type="button"
                            disabled={isDisabled}
                            onClick={() => handleDateSelect(item.date)}
                            className={`p-3 rounded-xl flex flex-col items-center justify-center transition-all ${isDateSelected ? "bg-green-600 text-white" : isDisabled ? "bg-gray-100 text-gray-400" : "bg-white border hover:bg-green-50"}`}
                          >
                            <span className="text-xs uppercase">{format(item.date, "EEE", { locale: es })}</span>
                            <span className="text-2xl font-bold">{format(item.date, "d")}</span>
                            {hasExistingPermit && <span className="text-[0.6rem] text-red-600">Enviada</span>}
                          </button>
                        )
                      })}
                    </div>
                  </CardContent>
                </motion.div>

                <motion.div className="bg-gradient-to-r from-green-50 to-white rounded-2xl border border-green-100 shadow-lg p-6" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                  <div className="flex items-center mb-4"><FileText className="h-6 w-6 mr-3 text-green-600" /><h3 className="text-green-800 font-bold text-xl">Detalles</h3></div>
                  <Textarea value={descriptionValue} onChange={(e) => setDescriptionValue(e.target.value)} placeholder="Detalle de solicitud..." className="min-h-[140px] border-green-200" />
                </motion.div>

                <Button type="submit" className="w-full bg-emerald-600 text-white hover:bg-emerald-700 py-6 rounded-full text-lg shadow-xl" disabled={connectionAwareSubmit.state.isSubmitting || !noveltyType}>
                  {connectionAwareSubmit.state.isSubmitting ? "Enviando..." : "Enviar Solicitud"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {isSuccess && (
        <Dialog open={isSuccess} onOpenChange={setIsSuccess}>
          <DialogContent className="bg-white rounded-3xl p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700">¡Solicitud Enviada!</h2>
            <Button onClick={() => setIsSuccess(false)} className="mt-6 bg-green-600 text-white">Entendido</Button>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={isTypeDialogOpen} onOpenChange={setIsTypeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
            {noveltyOptions.map((type) => (
              <div key={type.id} onClick={() => {
                if (type.id === "subpolitica") { setIsSubpoliticaDialogOpen(true); setIsTypeDialogOpen(false); }
                else { setNoveltyType(type.id); setIsTypeDialogOpen(false); }
              }} className={`p-4 rounded-xl cursor-pointer ${type.color} border-2 hover:border-green-400 transition-all`}>
                <type.icon className={`h-8 w-8 ${type.iconColor} mb-2`} />
                <h3 className="font-bold">{type.label}</h3>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubpoliticaDialogOpen} onOpenChange={setIsSubpoliticaDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <Input placeholder="Buscar..." value={subpoliticaSearchTerm} onChange={e => setSubpoliticaSearchTerm(e.target.value)} className="mb-4" />
          {Object.entries(filteredGroupedSubpoliticas).map(([politica, subs]) => (
            <div key={politica} className="mb-4">
              <h3 className="font-bold text-green-700 mb-2">{politica}</h3>
              <div className="grid grid-cols-2 gap-2">
                {subs.map(sub => (
                  <div key={sub} onClick={() => { setSelectedSubpolitica(sub); setNoveltyType("subpolitica"); setIsSubpoliticaDialogOpen(false); }} className="p-3 bg-gray-50 rounded hover:bg-green-50 cursor-pointer">
                    {sub}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </DialogContent>
      </Dialog>

      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent className="bg-white"><h2 className="text-red-600 font-bold">Error</h2><p>{errorMessage}</p></DialogContent>
      </Dialog>
    </div>
  )
}
