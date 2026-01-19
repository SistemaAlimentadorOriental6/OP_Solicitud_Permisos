"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"

// Importar componentes comunes del proyecto
import LoadingOverlay from "../../components/loading-overlay"
import { UserSelectDialog } from "../../components/user-select-dialog"
import { SuccessMessage } from "../../components/SuccessMessage"
import { ErrorModal } from "../../components/ErrorModal"
import BottomNavigation from "../../components/BottomNavigation"

// UI Components
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  Loader2,
  Search,
  Clock,
  User,
  ChevronRight,
  MapPin,
  Sunrise,
  Sunset,
  Shield,
  Phone,
  AlertCircle
} from "lucide-react"

// Hooks
import useUserData from "../hooks/useUserData"
import useConnectionAwareSubmit from "@/hooks/useConnectionAwareSubmit"
import { toast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

interface UserInterface {
  code: string
  name: string
}

export default function EquipmentRequestForm() {
  const POSTULACIONES_CERRADAS = true; // Cambiar a false para abrir las postulaciones

  const router = useRouter()
  const { userData, isLoading: isLoadingUser } = useUserData()

  // Estados de carga y éxito
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState("")

  // Estados del formulario
  const [selectedType, setSelectedType] = useState("")
  const [selectedAMUser, setSelectedAMUser] = useState<UserInterface | null>(null)
  const [selectedPMUser, setSelectedPMUser] = useState<UserInterface | null>(null)
  const [zone, setZone] = useState("")
  const [fixedShift, setFixedShift] = useState("")
  const [description, setDescription] = useState("")

  // Listas y Modales
  const [usersList, setUsersList] = useState<UserInterface[]>([])
  const [isAMDialogOpen, setIsAMDialogOpen] = useState(false)
  const [isPMDialogOpen, setIsPMDialogOpen] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")
  const [hasNewNotification, setHasNewNotification] = useState(false)

  const zones = [
    "Acevedo",
    "Tricentenario",
    "Universidad-gardel",
    "Hospital",
    "Prado",
    "Cruz",
    "Exposiciones - San Antonio - Alpujarra",
    "Alejandro"
  ]

  // Hook de envío con protección de conexión
  const { submit, state: submitState } = useConnectionAwareSubmit(
    async (data: any, signal: AbortSignal) => {
      const response = await fetch("/api/equipment/equipment-request", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${data.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data.payload),
        signal
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || "Error al enviar la solicitud")
      }

      return response.json()
    },
    {
      timeout: 45000,
      onConnectionIssue: (issue) => {
        toast({
          title: "Problema de conexión",
          description: issue,
          variant: "destructive",
        })
      }
    }
  )

  useEffect(() => {
    // Cargar lista de usuarios para los selectores
    const fetchUsersList = async () => {
      try {
        const token = localStorage.getItem("accessToken")
        const response = await fetch("/api/users/list", {
          headers: {
            "Authorization": `Bearer ${token}`
          }
        })
        if (!response.ok) throw new Error("Error al obtener la lista de usuarios")
        const data = await response.json()
        setUsersList(data)
      } catch (err) {
        console.error("Error fetching users list:", err)
      }
    }

    if (userData) {
      fetchUsersList()
    }

    // Check notifications
    const stored = localStorage.getItem("dashboardNotifications")
    if (stored) {
      const parsed = JSON.parse(stored)
      setHasNewNotification(parsed.some((n: any) => n.isNew))
    }
  }, [userData])

  const validateForm = () => {
    if (!selectedType) {
      setErrorMessage("Por favor seleccione el tipo de equipo.")
      setIsErrorModalOpen(true)
      return false
    }

    if (selectedType === "Turno pareja") {
      if (!selectedAMUser || !selectedPMUser) {
        setErrorMessage("Para turno pareja, debes seleccionar tanto el turno AM como el PM.")
        setIsErrorModalOpen(true)
        return false
      }
      if (selectedAMUser.code === selectedPMUser.code) {
        setErrorMessage("Para turno pareja, los códigos de AM y PM deben ser diferentes.")
        setIsErrorModalOpen(true)
        return false
      }
      if (!zone) {
        setErrorMessage("Para turno pareja, debes seleccionar una zona.")
        setIsErrorModalOpen(true)
        return false
      }
    }

    if (selectedType === "Tabla partida" && !zone) {
      setErrorMessage("Para tabla partida, debes seleccionar una zona.")
      setIsErrorModalOpen(true)
      return false
    }

    if (selectedType === "Disponible fijo" && !fixedShift) {
      setErrorMessage("Para disponible fijo, debes seleccionar el tipo de disponibilidad.")
      setIsErrorModalOpen(true)
      return false
    }

    // La descripción es opcional
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    try {
      const token = localStorage.getItem("accessToken")
      if (!token) throw new Error("No se encontró el token de acceso")

      const payload = {
        type: selectedType,
        description: description,
        zona: (selectedType === "Turno pareja" || selectedType === "Tabla partida") ? zone : null,
        codeAM: selectedAMUser?.code || null,
        codePM: selectedPMUser?.code || null,
        shift: selectedType === "Disponible fijo" ? fixedShift : null,
      }

      await submit({ payload, token })

      setIsSuccess(true)

      // Reset form
      setSelectedType("")
      setSelectedAMUser(null)
      setSelectedPMUser(null)
      setZone("")
      setFixedShift("")
      setDescription("")

      setTimeout(() => setIsSuccess(false), 5000)
    } catch (err) {
      console.error("Error al enviar:", err)
      setError("Ocurrió un error al enviar la solicitud. Por favor, inténtelo de nuevo.")
    }
  }

  const handleAMUserSelect = (user: UserInterface) => {
    setSelectedAMUser(user)
    if (selectedType === "Turno pareja" && selectedPMUser && user.code === selectedPMUser.code) {
      setErrorMessage("Los códigos de AM y PM deben ser diferentes.")
      setIsErrorModalOpen(true)
    }
  }

  const handlePMUserSelect = (user: UserInterface) => {
    setSelectedPMUser(user)
    if (selectedType === "Turno pareja" && selectedAMUser && user.code === selectedAMUser.code) {
      setErrorMessage("Los códigos de AM y PM deben ser diferentes.")
      setIsErrorModalOpen(true)
    }
  }

  if (isLoadingUser) {
    return <LoadingOverlay />
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col pb-32">
      {/* Header Estilo Proyecto */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-md bg-white/90">
        <div className="container mx-auto max-w-7xl px-4 h-20 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Solicitud de Postulaciones</h1>
            <p className="text-[10px] uppercase font-black text-gray-400 tracking-[0.2em]">
              Nueva Postulación
            </p>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto max-w-4xl px-4 py-8 space-y-8">
        <AnimatePresence>
          {submitState.isSubmitting && <LoadingOverlay />}
        </AnimatePresence>

        {POSTULACIONES_CERRADAS && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-[32px] p-8 sm:p-10 shadow-xl shadow-red-100/50 border border-red-50 relative overflow-hidden group hover:shadow-2xl transition-all duration-500"
          >
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0 group-hover:scale-110 transition-transform duration-500">
                <AlertCircle className="h-10 w-10 animate-pulse" />
              </div>
              <div className="text-center md:text-left space-y-2">
                <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">
                  Postulaciones <span className="text-red-500 italic">Cerradas</span>
                </h2>
                <p className="text-gray-500 font-medium leading-relaxed max-w-xl">
                  En este momento el proceso de postulaciones ha finalizado y <span className="font-bold text-gray-900">ya no se reciben más solicitudes</span>. Agradecemos mucho tu interés en participar.
                </p>
              </div>
              <div className="md:ml-auto">
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="rounded-2xl border-2 border-gray-100 hover:border-red-500 hover:bg-red-50 hover:text-red-500 font-black uppercase tracking-widest text-[10px] h-12 px-8 transition-all active:scale-95"
                >
                  Regresar
                </Button>
              </div>
            </div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-red-50/50 rounded-full blur-3xl group-hover:bg-red-100/50 transition-colors" />
          </motion.div>
        )}

        {/* Banner de Bienvenida Premium */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[32px] p-8 shadow-sm border border-gray-100 relative overflow-hidden"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-center gap-6">
            <div className="flex items-center gap-6 bg-white p-6 rounded-[28px] border border-gray-100 shadow-sm transition-all hover:shadow-md min-w-[320px]">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#4cc253] flex items-center justify-center text-white font-black text-xl sm:text-2xl shadow-lg shadow-[#4cc253]/20 flex-shrink-0">
                {userData?.name ? userData.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() : 'U'}
              </div>
              <div className="space-y-1.5 overflow-hidden">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-[#4cc253] flex-shrink-0" />
                  <p className="text-base sm:text-lg font-black text-gray-900 tracking-tight uppercase leading-tight truncate">
                    {userData?.name}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Shield className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                    ID: <span className="text-gray-900">{userData?.code}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 text-gray-500">
                  <Phone className="h-4 w-4 flex-shrink-0" />
                  <p className="text-xs sm:text-sm font-bold">
                    {userData?.phone || "Sin teléfono registrado"}
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-[#4cc253]/5 rounded-full blur-3xl" />
        </motion.div>

        {/* Formulario Principal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-[40px] shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden"
        >
          <form onSubmit={handleSubmit} className="p-8 sm:p-12 space-y-10">
            {/* Selección de Tipo */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <div className="w-1.5 h-6 bg-[#4cc253] rounded-full" />
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Configuración de Solicitud</h3>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <Label htmlFor="type" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2">Tipo de Postulación</Label>
                  <Select
                    required
                    name="type"
                    value={selectedType}
                    onValueChange={(value) => {
                      setSelectedType(value)
                      // Reset conditional fields
                      setSelectedAMUser(null)
                      setSelectedPMUser(null)
                      setZone("")
                      setFixedShift("")
                    }}
                  >
                    <SelectTrigger className="h-16 px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 hover:bg-white hover:border-[#4cc253]/30 transition-all font-bold text-gray-800">
                      <SelectValue placeholder="Seleccione el tipo de equipo" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2">
                      <SelectItem value="Turno pareja" className="rounded-xl py-3 font-bold">Turno pareja</SelectItem>
                      <SelectItem value="Tabla partida" className="rounded-xl py-3 font-bold">Tabla partida</SelectItem>
                      <SelectItem value="Disponible fijo" className="rounded-xl py-3 font-bold">Disponible fijo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Campos Condicionales con Animación */}
            <AnimatePresence mode="wait">
              {selectedType === 'Turno pareja' && (
                <motion.div
                  key="turno-pareja-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-8"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* AM Selector */}
                    <div className="space-y-3 cursor-pointer" onClick={() => setIsAMDialogOpen(true)}>
                      <Label htmlFor="codeAM" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2 flex items-center gap-2">
                        <Sunrise className="h-4 w-4 text-[#4cc253]" /> Código Turno AM
                      </Label>
                      <div className="relative group">
                        <div className="h-16 w-full px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 flex items-center group-hover:bg-white group-hover:border-[#4cc253]/30 transition-all">
                          {selectedAMUser ? (
                            <span className="font-bold text-gray-900">{selectedAMUser.code} - {selectedAMUser.name}</span>
                          ) : (
                            <span className="text-gray-400 font-medium">Seleccione usuario AM</span>
                          )}
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-hover:text-[#4cc253] transition-colors" />
                        </div>
                      </div>
                    </div>

                    {/* PM Selector */}
                    <div className="space-y-3 cursor-pointer" onClick={() => setIsPMDialogOpen(true)}>
                      <Label htmlFor="codePM" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2 flex items-center gap-2">
                        <Sunset className="h-4 w-4 text-[#4cc253]" /> Código Turno PM
                      </Label>
                      <div className="relative group">
                        <div className="h-16 w-full px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 flex items-center group-hover:bg-white group-hover:border-[#4cc253]/30 transition-all">
                          {selectedPMUser ? (
                            <span className="font-bold text-gray-900">{selectedPMUser.code} - {selectedPMUser.name}</span>
                          ) : (
                            <span className="text-gray-400 font-medium">Seleccione usuario PM</span>
                          )}
                          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-hover:text-[#4cc253] transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Zona Selection */}
                  <div className="space-y-3">
                    <Label htmlFor="zona" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2 flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-[#4cc253]" /> Selecciona la Zona
                    </Label>
                    <Select required name="zona" value={zone} onValueChange={setZone}>
                      <SelectTrigger className="h-16 px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 hover:bg-white hover:border-[#4cc253]/30 transition-all font-bold text-gray-800">
                        <SelectValue placeholder="Seleccione la zona operativa" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2 max-h-[300px]">
                        {zones.map((z) => (
                          <SelectItem key={z} value={z} className="rounded-xl py-3 font-bold">{z}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </motion.div>
              )}

              {selectedType === 'Tabla partida' && (
                <motion.div
                  key="tabla-partida-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <Label htmlFor="zona" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#4cc253]" /> Selecciona la Zona
                  </Label>
                  <Select required name="zona" value={zone} onValueChange={setZone}>
                    <SelectTrigger className="h-16 px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 hover:bg-white hover:border-[#4cc253]/30 transition-all font-bold text-gray-800">
                      <SelectValue placeholder="Seleccione la zona operativa" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2 max-h-[300px]">
                      {zones.map((z) => (
                        <SelectItem key={z} value={z} className="rounded-xl py-3 font-bold">{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </motion.div>
              )}

              {selectedType === 'Disponible fijo' && (
                <motion.div
                  key="disponible-fijo-fields"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-3"
                >
                  <Label htmlFor="fixedShift" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-[#4cc253]" /> Tipo de disponibilidad
                  </Label>
                  <Select required name="fixedShift" value={fixedShift} onValueChange={setFixedShift}>
                    <SelectTrigger className="h-16 px-6 rounded-2xl border-2 border-gray-100 bg-gray-50/50 hover:bg-white hover:border-[#4cc253]/30 transition-all font-bold text-gray-800">
                      <SelectValue placeholder="Seleccione el tipo de disponibilidad" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-gray-100 shadow-2xl p-2">
                      <SelectItem value="Disponible Fijo AM" className="rounded-xl py-3 font-bold">Disponible Fijo AM</SelectItem>
                      <SelectItem value="Disponible Fijo PM" className="rounded-xl py-3 font-bold">Disponible Fijo PM</SelectItem>
                      <SelectItem value="Turno Cualquiera Ruta AM" className="rounded-xl py-3 font-bold">Turno a cualquiera ruta AM</SelectItem>
                      <SelectItem value="Turno Cualquiera Ruta PM" className="rounded-xl py-3 font-bold">Turno a cualquiera ruta PM</SelectItem>
                    </SelectContent>
                  </Select>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Descripción */}
            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-2 px-2">
                <div className="w-1.5 h-6 bg-[#4cc253] rounded-full" />
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">Detalles del Motivo</h3>
              </div>
              <div className="space-y-3">
                <Label htmlFor="description" className="text-sm font-black text-gray-700 uppercase tracking-tighter ml-2">Descripción de la Solicitud (Opcional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalla aquí los motivos de tu solicitud de equipo (opcional)..."
                  className="min-h-[140px] p-6 rounded-[30px] border-2 border-gray-100 bg-gray-50/50 focus:bg-white focus:border-[#4cc253] focus:ring-4 focus:ring-[#4cc253]/10 transition-all resize-none font-medium"
                />
                <div className="flex items-center justify-between px-2">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Campo Opcional</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    {description.length} caracteres
                  </p>
                </div>
              </div>
            </div>

            {!POSTULACIONES_CERRADAS && (
              <motion.div
                className="pt-6"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <Button
                  type="submit"
                  disabled={submitState.isSubmitting || !selectedType}
                  className="w-full h-16 bg-gray-900 hover:bg-black text-white rounded-[24px] font-black uppercase tracking-[0.2em] text-xs shadow-2xl shadow-gray-200 transition-all flex items-center justify-center gap-3"
                >
                  {submitState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Enviando Solicitud...
                    </>
                  ) : (
                    <>
                      Enviar Solicitud <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </form>
        </motion.div>
      </main>

      {/* Shared Dialogs from the project */}
      <UserSelectDialog
        open={isAMDialogOpen}
        onOpenChange={setIsAMDialogOpen}
        onSelect={handleAMUserSelect}
        users={usersList}
        currentUser={userData || { code: '', name: '' }}
        title="Seleccionar Usuario AM"
      />

      <UserSelectDialog
        open={isPMDialogOpen}
        onOpenChange={setIsPMDialogOpen}
        onSelect={handlePMUserSelect}
        users={usersList}
        currentUser={userData || { code: '', name: '' }}
        title="Seleccionar Usuario PM"
      />

      <SuccessMessage
        isVisible={isSuccess}
        onClose={() => setIsSuccess(false)}
      />

      <ErrorModal
        isOpen={isErrorModalOpen}
        onClose={() => setIsErrorModalOpen(false)}
        message={errorMessage}
      />

      {error && (
        <ErrorModal
          isOpen={!!error}
          onClose={() => setError('')}
          message={error}
        />
      )}

      {/* Bottom Navigation for mobile */}
      <BottomNavigation hasNewNotification={hasNewNotification} />
    </div>
  )
}

