import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { motion, AnimatePresence } from "framer-motion"
import {
    X,
    Search,
    Loader2,
    IdCard,
    Briefcase,
    ChevronRight,
    UserPlus
} from "lucide-react"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { getInitials } from "@/app/solicitud-permisos/utils"

export interface Employee {
    cedula: string;
    nombre: string;
    cargo: string;
    foto?: string;
    code?: string;
    password?: string;
}

interface EmployeeSelectionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    employees: Employee[];
    employeesLoading: boolean;
    onEmployeeSelect: (employee: Employee) => void;
}

export const EmployeeSelectionDialog: React.FC<EmployeeSelectionDialogProps> = ({
    isOpen,
    onClose,
    employees,
    employeesLoading,
    onEmployeeSelect
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [mounted, setMounted] = useState(false);

    // Pagination / Lazy Load state
    const [displayedCount, setDisplayedCount] = useState(20);
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Filter employees based on search term
    const filteredEmployees = employees.filter(employee =>
        (employee.nombre && employee.nombre.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (employee.cedula && employee.cedula.includes(searchTerm)) ||
        (employee.cargo && employee.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    // Calculate which employees to show based on pagination
    const visibleEmployees = filteredEmployees.slice(0, displayedCount);

    // Infinite scroll observer
    useEffect(() => {
        if (!isOpen) {
            setDisplayedCount(20);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayedCount((prev) => Math.min(prev + 20, filteredEmployees.length));
                }
            },
            { threshold: 0.5 } // Trigger when 50% visible
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => {
            if (observerTarget.current) {
                observer.unobserve(observerTarget.current);
            }
        };
    }, [isOpen, filteredEmployees.length, observerTarget]); // Re-run if list changes size

    // Reset pagination when search changes
    useEffect(() => {
        setDisplayedCount(20);
    }, [searchTerm]);

    if (!mounted) return null;

    // Loading Skeleton Component
    const LoadingSkeleton = () => (
        <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4 border border-gray-100 rounded-2xl bg-white animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-gray-200" />
                    <div className="flex-1 space-y-2">
                        <div className="h-5 w-40 bg-gray-200 rounded" />
                        <div className="flex gap-4">
                            <div className="h-3 w-20 bg-gray-200 rounded" />
                            <div className="h-3 w-32 bg-gray-200 rounded" />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4"
                    onClick={onClose}
                    style={{ zIndex: 99999, position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', touchAction: "none" }}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        className="bg-white rounded-[32px] shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden border border-gray-100 flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header Minimalista */}
                        <div className="bg-white p-8 pb-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-start justify-between">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <div className="bg-[#4cc253]/10 p-2 rounded-xl">
                                            <UserPlus className="h-6 w-6 text-[#4cc253]" />
                                        </div>
                                        <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                                            Seleccionar Empleado
                                        </h2>
                                    </div>
                                    <p className="text-gray-500 font-medium ml-1">
                                        Busca y selecciona un empleado para continuar la solicitud
                                    </p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors group"
                                >
                                    <X className="h-6 w-6 text-gray-400 group-hover:text-gray-600" />
                                </button>
                            </div>

                            {/* Search bar integrada */}
                            <div className="mt-6 relative group">
                                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5 transition-colors group-focus-within:text-[#4cc253]" />
                                <input
                                    type="text"
                                    placeholder="Buscar por nombre, cédula o cargo..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-100 focus:border-[#4cc253] focus:ring-2 focus:ring-[#4cc253]/20 rounded-2xl font-bold text-gray-900 transition-all placeholder:text-gray-400 outline-none"
                                    autoFocus
                                />
                                {searchTerm && (
                                    <button
                                        onClick={() => setSearchTerm("")}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-200 text-gray-400"
                                    >
                                        <X size={16} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto p-6 bg-white custom-scrollbar">
                            {employeesLoading ? (
                                <div className="flex flex-col py-4">
                                    <div className="flex items-center justify-center mb-6 text-[#4cc253] font-bold gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        <span>Cargando directorio...</span>
                                    </div>
                                    <LoadingSkeleton />
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredEmployees.length === 0 ? (
                                        <div className="text-center py-20">
                                            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <Search className="h-8 w-8 text-gray-400" />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 mb-2">No se encontraron resultados</h3>
                                            <p className="text-gray-500 max-w-xs mx-auto">
                                                Intenta con otro término de búsqueda o verifica la información.
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Render only visible employees for lazy loading */}
                                            {visibleEmployees.map((employee, index) => (
                                                <motion.div
                                                    key={`${employee.cedula}-${index}`}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ delay: index < 10 ? index * 0.05 : 0 }}
                                                    onClick={() => onEmployeeSelect(employee)}
                                                    className="group cursor-pointer bg-white border border-gray-100 rounded-2xl p-4 hover:border-[#4cc253]/50 hover:bg-gray-50 hover:shadow-lg hover:shadow-[#4cc253]/5 transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <Avatar className="h-14 w-14 border border-gray-100 shadow-sm group-hover:scale-105 transition-transform">
                                                            <AvatarImage
                                                                src={employee.foto}
                                                                loading="lazy"
                                                                className="object-cover"
                                                            />
                                                            <AvatarFallback className="bg-[#4cc253] text-white font-black text-lg">
                                                                {getInitials(employee.nombre)}
                                                            </AvatarFallback>
                                                        </Avatar>

                                                        <div className="flex-1 min-w-0">
                                                            <h3 className="text-lg font-black text-gray-900 truncate group-hover:text-[#4cc253] transition-colors">
                                                                {employee.nombre}
                                                            </h3>
                                                            <div className="flex items-center gap-4 mt-1">
                                                                <div className="flex items-center text-gray-500">
                                                                    <IdCard className="h-3.5 w-3.5 mr-1.5" />
                                                                    <span className="text-xs font-bold uppercase tracking-wider">{employee.cedula}</span>
                                                                </div>
                                                                <div className="flex items-center text-gray-500">
                                                                    <Briefcase className="h-3.5 w-3.5 mr-1.5" />
                                                                    <span className="text-xs font-bold uppercase tracking-wider truncate max-w-[150px]">{employee.cargo}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity -translate-x-2 group-hover:translate-x-0 transform duration-200">
                                                            <div className="bg-[#4cc253] p-2 rounded-full shadow-md shadow-[#4cc253]/30">
                                                                <ChevronRight className="h-5 w-5 text-white" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}

                                            {/* Loader Trigger div */}
                                            {visibleEmployees.length < filteredEmployees.length && (
                                                <div ref={observerTarget} className="py-4 flex justify-center w-full">
                                                    <div className="flex items-center text-gray-400 text-sm font-medium gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Cargando más empleados...
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-gray-100 bg-gray-50/50 shrink-0">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                                    {filteredEmployees.length} {filteredEmployees.length === 1 ? 'Empleado' : 'Empleados'} encontrados
                                </p>
                                <Button
                                    onClick={onClose}
                                    variant="ghost"
                                    className="text-gray-500 hover:text-gray-900 hover:bg-gray-100 font-bold rounded-xl"
                                >
                                    Cancelar
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};
