import React, { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
    User,
    Shield,
    Phone,
    Search,
    Loader2,
    UserPlus,
    CheckCircle,
    Briefcase
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/app/solicitud-permisos/utils"
import { EmployeeSelectionDialog, Employee } from "./EmployeeSelectionDialog"

interface UserInfoCardProps {
    code: string | undefined
    name: string | undefined
    phone: string | undefined
    onPhoneEdit: () => void
    isExtemporaneous?: boolean
    onEmployeeSelect?: (employee: any) => void
    selectedEmployee?: any
    userType?: string
}

export const AdminUserInfoCard: React.FC<UserInfoCardProps> = ({
    code,
    name,
    phone,
    onPhoneEdit,
    isExtemporaneous = false,
    onEmployeeSelect,
    selectedEmployee,
    userType: propUserType
}) => {
    const [employees, setEmployees] = useState<Employee[]>([])
    const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false)
    const [employeesLoading, setEmployeesLoading] = useState(false)
    const [userType, setUserType] = useState(propUserType || '')

    useEffect(() => {
        if (propUserType) {
            setUserType(propUserType)
        } else {
            const userData = JSON.parse(localStorage.getItem('userData') || '{}')
            setUserType(userData.userType || '')
        }
    }, [isExtemporaneous, propUserType])

    const handleEmployeeSelect = (employee: Employee) => {
        if (onEmployeeSelect) {
            onEmployeeSelect(employee)
        }
        setIsEmployeeDialogOpen(false)
    }

    const fetchEmployees = async () => {
        setEmployeesLoading(true)
        try {
            const token = localStorage.getItem("accessToken")

            if (userType === 'se_operaciones') {
                const mysqlResponse = await fetch('/api/users/user/lists?limit=1000', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })

                if (!mysqlResponse.ok) {
                    throw new Error('Error al obtener usuarios de MySQL')
                }

                const mysqlResult = await mysqlResponse.json()
                const mysqlUsers = mysqlResult.data || []

                // OPTIMIZATION: Do NOT pre-validate images with fetch(HEAD).
                // It's extremely slow for 1000 users.
                // Let the browser handle 404s via the <img> tag naturally.
                // We just construct the likely URL.

                const formattedEmployees = mysqlUsers
                    .filter((user: any) => user.name && user.code) // Basic filtering
                    .map((user: any) => {
                        // Assumption: The image is likely .jpg.
                        // If it fails, the Avatar component will show initials.
                        // This is much better for performance.
                        const baseUrl = 'https://admon.sao6.com.co/web/uploads/empleados/'
                        const fotoUrl = `${baseUrl}${user.password}.jpg`

                        return {
                            nombre: user.name,
                            cedula: user.password,
                            cargo: user.cargo || 'Usuario',
                            foto: fotoUrl, // We provide it optimistically
                            code: user.code,
                        }
                    })

                setEmployees(formattedEmployees)

            } else {
                const response = await fetch('/api/admin/maintenance-employees', {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                })

                if (response.ok) {
                    const result = await response.json()
                    const mappedEmployees = (result.data || [])
                        .map((emp: any) => {
                            return {
                                nombre: emp.name || emp.nombre || emp.f_nombre_empl,
                                cedula: emp.code || emp.cedula || emp.f_nit_empl,
                                cargo: emp.cargo || emp.f_desc_cargo,
                                foto: emp.avatar
                            }
                        })
                        .filter((emp: any) => emp.nombre && emp.cedula)

                    setEmployees(mappedEmployees)
                }
            }
        } catch (error) {
            console.error("Error fetching employees:", error)
        } finally {
            setEmployeesLoading(false)
        }
    }

    const CardContainer = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`bg-white rounded-3xl p-6 border border-gray-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] relative overflow-hidden ${className}`}
        >
            {children}
        </motion.div>
    )

    if (isExtemporaneous && (userType === 'se_maintenance' || userType === 'se_operaciones')) {
        return (
            <>
                {!selectedEmployee ? (
                    <CardContainer className="border-dashed border-2 bg-gray-50/50">
                        <div className="text-center relative z-10 py-4">
                            <div className="mx-auto w-20 h-20 bg-white border border-gray-100 rounded-full flex items-center justify-center mb-4 shadow-sm">
                                <UserPlus className="h-8 w-8 text-[#4cc253]" />
                            </div>

                            <h3 className="text-xl font-black text-gray-900 tracking-tight mb-2">
                                Seleccionar Empleado
                            </h3>
                            <p className="text-gray-500 mb-6 text-sm font-medium">
                                Para solicitud extemporánea, selecciona el empleado
                            </p>

                            <motion.button
                                onClick={() => {
                                    fetchEmployees()
                                    setIsEmployeeDialogOpen(true)
                                }}
                                className="bg-[#4cc253] hover:bg-[#3da343] text-white px-8 py-3 rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg hover:shadow-xl hover:scale-105 disabled:bg-gray-300 disabled:shadow-none"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                disabled={employeesLoading}
                            >
                                {employeesLoading ? (
                                    <div className="flex items-center space-x-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Cargando...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <Search className="h-4 w-4" />
                                        <span>Buscar Empleado</span>
                                    </div>
                                )}
                            </motion.button>
                        </div>
                    </CardContainer>
                ) : (
                    <CardContainer>
                        <div className="absolute top-6 right-6 z-20">
                            <motion.button
                                onClick={() => {
                                    fetchEmployees()
                                    setIsEmployeeDialogOpen(true)
                                }}
                                className="px-4 py-2 text-[10px] font-black uppercase tracking-widest bg-gray-100 hover:bg-[#4cc253] text-gray-500 hover:text-white rounded-xl transition-all duration-200"
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                Cambiar
                            </motion.button>
                        </div>

                        <div className="flex items-center relative z-10">
                            <div className="relative mr-6">
                                <Avatar className="h-20 w-20 border-2 border-gray-50 shadow-sm">
                                    <AvatarImage src={selectedEmployee.foto} alt={selectedEmployee.nombre} />
                                    <AvatarFallback className="bg-[#4cc253] text-white text-xl font-black">
                                        {getInitials(selectedEmployee.nombre)}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="absolute -top-1 -right-1 w-6 h-6 bg-[#4cc253] rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                    <CheckCircle className="h-3 w-3 text-white" />
                                </div>
                            </div>

                            <div className="flex-1 space-y-1">
                                <div className="flex items-center">
                                    <User className="h-4 w-4 text-[#4cc253] mr-2" />
                                    <h3 className="text-xl font-black text-gray-900 tracking-tight">
                                        {selectedEmployee.nombre}
                                    </h3>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center">
                                        <Shield className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mr-2">Cédula:</span>
                                        <span className="text-sm font-bold text-gray-600 font-mono">{selectedEmployee.cedula}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Briefcase className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mr-2">Cargo:</span>
                                        <span className="text-sm font-bold text-gray-600">{selectedEmployee.cargo}</span>
                                    </div>
                                    <div className="flex items-center">
                                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="text-sm font-bold text-gray-400 uppercase tracking-widest mr-2">Tel:</span>
                                        <span className="text-sm font-medium text-gray-600">{phone || "N/A"}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContainer>
                )}

                <EmployeeSelectionDialog
                    isOpen={isEmployeeDialogOpen}
                    onClose={() => setIsEmployeeDialogOpen(false)}
                    employees={employees}
                    employeesLoading={employeesLoading}
                    onEmployeeSelect={handleEmployeeSelect}
                />
            </>
        )
    }

    return (
        <CardContainer>
            <div className="flex items-center relative z-10">
                <Avatar className="h-20 w-20 border-2 border-gray-50 shadow-sm mr-6">
                    <AvatarFallback className="bg-[#4cc253] text-white text-xl font-black">
                        {getInitials(name)}
                    </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                    <div className="flex items-center">
                        <User className="h-4 w-4 text-[#4cc253] mr-2" />
                        <h3 className="text-xl font-black text-gray-900 tracking-tight">{name || "Usuario"}</h3>
                    </div>
                    <div className="flex items-center">
                        <Shield className="h-4 w-4 text-gray-400 mr-2" />
                        <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">ID: {code || "000"}</p>
                    </div>
                    <div className="flex items-center group cursor-pointer" onDoubleClick={onPhoneEdit}>
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        <p className="text-sm font-medium text-gray-600 group-hover:text-[#4cc253] transition-colors">
                            {phone || "Sin teléfono registrado"}
                        </p>
                    </div>
                </div>
            </div>
        </CardContainer>
    )
}
