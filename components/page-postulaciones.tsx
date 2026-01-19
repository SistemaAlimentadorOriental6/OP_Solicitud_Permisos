'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, AlertCircle, Search } from 'lucide-react'
import { Alert, AlertDescription } from "@/components/ui/alert"
import Navigation from './navigation'
import LoadingOverlay from './loading-overlay'
import { UserSelectDialog } from './user-select-dialog'
import { SuccessMessage } from './SuccessMessage'
import { ErrorModal } from './ErrorModal'

interface User {
  code: string;
  name: string;
}

export default function EquipmentRequestForm() {
  const POSTULACIONES_CERRADAS = true; // Cambiar a false para abrir las postulaciones

  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [userData, setUserData] = useState<User>({ code: '', name: '' })
  const [error, setError] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedAMUser, setSelectedAMUser] = useState<User | null>(null)
  const [selectedPMUser, setSelectedPMUser] = useState<User | null>(null)
  const [zone, setZone] = useState('')
  const [usersList, setUsersList] = useState<User[]>([])
  const [isAMDialogOpen, setIsAMDialogOpen] = useState(false)
  const [isPMDialogOpen, setIsPMDialogOpen] = useState(false)
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()

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

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = localStorage.getItem('accessToken')

        if (!token) {
          router.push('/')
          return
        }

        const response = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.status === 401) {
          localStorage.removeItem('accessToken')
          router.push('/')
          return
        }

        if (!response.ok) {
          throw new Error('Error al obtener datos del usuario')
        }

        const data = await response.json()
        setUserData({ code: data.code, name: data.name })
      } catch (error) {
        console.error('Error fetching user data:', error)
        setError('No se pudieron cargar los datos del usuario. Por favor, inicie sesión nuevamente.')
      } finally {
        setIsLoading(false)
      }
    }

    const fetchUsersList = async () => {
      try {
        const response = await fetch('/api/users/list')
        if (!response.ok) {
          throw new Error('Error al obtener la lista de usuarios')
        }
        const data = await response.json()
        setUsersList(data)
      } catch (error) {
        console.error('Error fetching users list:', error)
      }
    }

    fetchUserData()
    fetchUsersList()
  }, [router])

  const validateForm = () => {
    if (selectedType === 'Turno pareja') {
      if (!selectedAMUser || !selectedPMUser) {
        setErrorMessage('Para turno pareja, debes seleccionar tanto el turno AM como el PM.')
        setIsErrorModalOpen(true)
        return false
      }
      if (selectedAMUser.code === selectedPMUser.code) {
        setErrorMessage('Para turno pareja, los códigos de AM y PM deben ser diferentes.')
        setIsErrorModalOpen(true)
        return false
      }
      if (!zone) {
        setErrorMessage('Para turno pareja, debes seleccionar una zona.')
        setIsErrorModalOpen(true)
        return false
      }
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    if (!validateForm()) {
      setIsSubmitting(false)
      return
    }

    const formElement = e.target as HTMLFormElement
    const formData = {
      type: selectedType,
      description: formElement.description.value,
      zona: (selectedType === 'Turno pareja' || selectedType === 'Tabla partida') ? zone : undefined,
      codeAM: selectedAMUser?.code,
      codePM: selectedPMUser?.code,
      shift: selectedType === 'Disponible fijo' ? formElement.fixedShift?.value : undefined,
    }

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        throw new Error('No se encontró el token de acceso')
      }

      const response = await fetch('/api/equipment-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(`Error al enviar la solicitud: ${errorData.detail}`)
      }

      setIsSuccess(true);
      // Reset the form
      formElement.reset()
      setSelectedType('')
      setSelectedAMUser(null)
      setSelectedPMUser(null)
      setZone('')
    } catch (error) {
      console.error('Error:', error)
      setError('Ocurrió un error al enviar la solicitud. Por favor, inténtelo de nuevo.')
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setIsSuccess(false), 5000)
    }
  }

  const handleAMUserSelect = (user: User) => {
    setSelectedAMUser(user)
    if (selectedType === 'Turno pareja' && selectedPMUser && user.code === selectedPMUser.code) {
      setErrorMessage('Los códigos de AM y PM deben ser diferentes.')
      setIsErrorModalOpen(true)
    }
  }

  const handlePMUserSelect = (user: User) => {
    setSelectedPMUser(user)
    if (selectedType === 'Turno pareja' && selectedAMUser && user.code === selectedAMUser.code) {
      setErrorMessage('Los códigos de AM y PM deben ser diferentes.')
      setIsErrorModalOpen(true)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-100 via-white to-green-200 flex items-center justify-center p-4">
        <div className="bg-white bg-opacity-40 backdrop-blur-lg rounded-3xl shadow-2xl p-8 max-w-md w-full">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="mt-4 flex justify-center">
            <Button
              onClick={() => router.push('/')}
              className="bg-green-500 text-white hover:bg-green-600"
            >
              Volver al inicio de sesión
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (POSTULACIONES_CERRADAS) {
    return (
      <div className="min-h-screen via-white to-green-200 flex flex-col items-center justify-center p-4 relative overflow-hidden bg-gradient-to-br from-green-50/50 via-white to-emerald-50/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-2xl bg-white/60 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden relative z-10 p-12 md:p-16 text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
            className="bg-gradient-to-tr from-green-100 to-emerald-100 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/50"
          >
            <AlertCircle className="h-12 w-12 text-green-600" />
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-green-800 to-emerald-800 mb-6"
          >
            Postulaciones Cerradas
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-green-700/80 text-xl leading-relaxed mb-10 max-w-md mx-auto"
          >
            Agradecemos mucho tu interés. En este momento el proceso de postulaciones ha finalizado y ya no se reciben más solicitudes.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Button
              onClick={() => router.push('/')}
              className="bg-green-600 hover:bg-green-700 text-white px-12 py-4 rounded-2xl text-lg font-bold transition-all hover:scale-105 shadow-lg hover:shadow-green-200/50 active:scale-95"
            >
              Volver al Inicio
            </Button>
          </motion.div>

          <footer className="mt-12 text-green-600/50 text-sm font-medium">
            Sistema Alimentador Oriental 6
          </footer>
        </motion.div>

        {/* Elementos decorativos de fondo */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-green-200/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/20 rounded-full blur-[120px] pointer-events-none" />
      </div>
    )
  }

  return (
    <div className="min-h-screen via-white to-green-200 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {(isLoading || isSubmitting) && <LoadingOverlay />}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-4xl bg-white bg-opacity-40 backdrop-blur-lg rounded-3xl shadow-2xl overflow-hidden relative z-10 px-4 sm:px-6 md:px-8"
      >
        <form onSubmit={handleSubmit} className="p-8 space-y-4 sm:space-y-6">
          <motion.h1
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="text-3xl sm:text-4xl font-bold text-green-700 text-center mb-6 sm:mb-8"
          >
            Solicitud de Postulaciones
          </motion.h1>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-green-700">Código</Label>
              <Input
                id="code"
                value={userData.code}
                readOnly
                className="border-green-300 focus:ring-green-500 bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="text-green-700">Nombre y Apellido</Label>
              <Input
                id="name"
                value={userData.name}
                readOnly
                className="border-green-300 focus:ring-green-500 bg-gray-50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="text-green-700">Tipo de equipo</Label>
              <Select
                required
                name="type"
                onValueChange={(value) => setSelectedType(value)}
              >
                <SelectTrigger className="border-green-300 focus:ring-green-500">
                  <SelectValue placeholder="Seleccione el tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Turno pareja">Turno pareja</SelectItem>
                  <SelectItem value="Tabla partida">Tabla partida</SelectItem>
                  <SelectItem value="Disponible fijo">Disponible fijo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedType === 'Turno pareja' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="codeAM" className="text-green-700">Código Turno AM</Label>
                  <div className="relative">
                    <Input
                      id="codeAM"
                      value={selectedAMUser ? `${selectedAMUser.code} - ${selectedAMUser.name}` : ''}
                      readOnly
                      className="border-green-300 focus:ring-green-500 pr-10"
                      placeholder="Seleccione usuario AM"
                      onClick={() => setIsAMDialogOpen(true)}
                    />
                    <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground cursor-pointer"
                      onClick={() => setIsAMDialogOpen(true)} />
                  </div>
                  <div className="text-sm text-green-700 mt-1">Turno AM</div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="codePM" className="text-green-700">Código Turno PM</Label>
                  <div className="relative">
                    <Input
                      id="codePM"
                      value={selectedPMUser ? `${selectedPMUser.code} - ${selectedPMUser.name}` : ''}
                      readOnly
                      className="border-green-300 focus:ring-green-500 pr-10"
                      placeholder="Seleccione usuario PM"
                      onClick={() => setIsPMDialogOpen(true)}
                    />
                    <Search className="absolute right-3 top-2.5 h-5 w-5 text-muted-foreground cursor-pointer"
                      onClick={() => setIsPMDialogOpen(true)} />
                  </div>
                  <div className="text-sm text-green-700 mt-1">Turno PM</div>
                </div>
              </div>
            )}

            {(selectedType === 'Turno pareja' || selectedType === 'Tabla partida') && (
              <div className="space-y-2">
                <Label htmlFor="zona" className="text-green-700">Selecciona la zona</Label>
                <Select required name="zona" onValueChange={setZone}>
                  <SelectTrigger className="border-green-300 focus:ring-green-500">
                    <SelectValue placeholder="Seleccione la zona" />
                  </SelectTrigger>
                  <SelectContent>
                    {zones.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedType === 'Disponible fijo' && (
              <div className="space-y-2">
                <Label htmlFor="fixedShift" className="text-green-700">Tipo de disponibilidad</Label>
                <Select required name="fixedShift">
                  <SelectTrigger className="border-green-300 focus:ring-green-500">
                    <SelectValue placeholder="Seleccione el tipo de disponibilidad" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Disponible Fijo AM">Disponible Fijo AM</SelectItem>
                    <SelectItem value="Disponible Fijo PM">Disponible Fijo PM</SelectItem>
                    <SelectItem value="Turno Cualquiera Ruta AM">Turno a cualquiera ruta AM</SelectItem>
                    <SelectItem value="Turno Cualquiera Ruta PM">Turno a cualquiera ruta PM</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description" className="text-green-700">Descripción de la solicitud</Label>
              <Textarea
                id="description"
                placeholder="Ingrese el detalle de tu solicitud de equipo"
                className="min-h-[100px] border-green-300 focus:ring-green-500"
                required
              />
            </div>
          </div>

          <div className="mt-6 sm:mt-8 flex justify-center">
            <Button
              type="submit"
              className="bg-green-500 text-white hover:bg-green-600 px-6 sm:px-8 py-2 sm:py-3 rounded-full text-base sm:text-lg font-semibold transition-all duration-300 transform hover:scale-105 hover:shadow-lg w-full sm:w-auto"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {isSubmitting ? 'Enviando...' : 'Enviar Solicitud'}
            </Button>
          </div>
        </form>
      </motion.div>

      <UserSelectDialog
        open={isAMDialogOpen}
        onOpenChange={setIsAMDialogOpen}
        onSelect={handleAMUserSelect}
        users={usersList}
        currentUser={userData}
        title="Seleccionar Usuario AM"
      />

      <UserSelectDialog
        open={isPMDialogOpen}
        onOpenChange={setIsPMDialogOpen}
        onSelect={handlePMUserSelect}
        users={usersList}
        currentUser={userData}
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
    </div>
  )
}


