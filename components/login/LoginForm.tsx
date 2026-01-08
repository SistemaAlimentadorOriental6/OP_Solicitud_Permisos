import React, { useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { User, Info, CheckCircle, AlertCircle, ArrowRight, CreditCard, EyeOff, Eye, LogIn } from "lucide-react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { formVariants, itemVariants } from "./variants"

interface LoginFormProps {
    formStep: number
    code: string
    setCode: (code: string) => void
    password: string
    setPassword: (password: string) => void
    isLoading: boolean
    error: string
    showPassword: boolean
    setShowPassword: (show: boolean) => void
    handleSubmit: (e: React.FormEvent) => void
    handleBackToCode: () => void
    validateCode: (code: string) => boolean
}

const LoginForm = ({
    formStep,
    code,
    setCode,
    password,
    setPassword,
    isLoading,
    error,
    showPassword,
    setShowPassword,
    handleSubmit,
    handleBackToCode,
    validateCode
}: LoginFormProps) => {

    const formatCodeDisplay = useCallback((code: string) => {
        return code.split("").join(" ")
    }, [])

    return (
        <AnimatePresence mode="wait">
            {formStep === 0 && (
                <motion.form
                    key="codeStep"
                    variants={formVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-8"
                    onSubmit={handleSubmit}
                >
                    <div className="space-y-4">
                        <Label
                            htmlFor="code"
                            className="text-gray-800 text-lg font-bold ml-2"
                        >
                            Código de acceso
                        </Label>
                        <div className="relative group">
                            <Input
                                id="code"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={code}
                                onChange={(e) => {
                                    const value = e.target.value
                                    if (value === "sao6admin") {
                                        setCode(value)
                                    } else {
                                        setCode(value.replace(/\D/g, "").slice(0, 4))
                                    }
                                }}
                                className="pl-6 border-none focus-visible:ring-2 focus-visible:ring-[#4cc253] text-xl h-20 bg-gray-100/50 hover:bg-gray-100 transition-all rounded-[2rem] font-bold text-gray-800 placeholder:text-gray-400 placeholder:font-medium"
                                placeholder="Ingresa tu código"
                                autoFocus
                            />
                            {code && (
                                <motion.div
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="absolute right-6 top-1/2 -translate-y-1/2"
                                >
                                    <CheckCircle className="text-[#4cc253] h-6 w-6" />
                                </motion.div>
                            )}
                        </div>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipContent side="bottom" className="max-w-xs bg-gray-900 text-white border-none rounded-xl p-4 shadow-2xl">
                                    <p className="text-sm leading-relaxed">
                                        Código de operador de 4 dígitos. <strong className="text-[#4cc253]">Déjelo vacío</strong> si usarás tu cédula directamente.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>

                    <motion.div
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Button
                            type="submit"
                            className="w-full bg-[#4cc253] hover:bg-[#3da342] text-white font-black py-4 rounded-[2rem] transition-all duration-300 transform active:scale-95 shadow-xl shadow-[#4cc253]/20 h-20 text-xl uppercase tracking-wider"
                            disabled={isLoading || (code.trim() !== "" && !validateCode(code))}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="animate-spin h-6 w-6 border-4 border-white/20 border-t-white rounded-full" />
                                    <span>Cargando</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <span>Continuar</span>
                                    <ArrowRight className="h-6 w-6" />
                                </div>
                            )}
                        </Button>
                    </motion.div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-[2rem] flex items-start gap-3"
                        >
                            <AlertCircle className="h-6 w-6 flex-shrink-0" />
                            <p className="font-bold text-sm tracking-tight">{error}</p>
                        </motion.div>
                    )}
                </motion.form>
            )}

            {formStep === 1 && (
                <motion.form
                    key="passwordStep"
                    variants={formVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-8"
                    onSubmit={handleSubmit}
                >
                    {/* User Preview Card */}
                    <div className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                                <User className="text-[#4cc253] h-7 w-7" />
                            </div>
                            <div>
                                <span className="text-xs text-gray-400 block font-black uppercase tracking-widest">Código</span>
                                <span className="font-bold text-gray-800 text-xl tracking-widest">
                                    {formatCodeDisplay(code)}
                                </span>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleBackToCode}
                            className="text-[#4cc253] hover:bg-[#4cc253]/10 font-black rounded-xl"
                        >
                            CORREGIR
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <Label
                            htmlFor="password"
                            className="text-gray-800 text-lg font-bold ml-2"
                        >
                            Contraseña
                        </Label>
                        <div className="relative group">
                            <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="pl-6 pr-16 border-none focus-visible:ring-2 focus-visible:ring-[#4cc253] text-xl h-20 bg-gray-100/50 hover:bg-gray-100 transition-all rounded-[2rem] font-bold text-gray-800"
                                placeholder="Ingresa tu contraseña"
                                required
                                autoFocus
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-2xl hover:bg-white flex items-center justify-center text-gray-400 hover:text-[#4cc253] transition-all"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-6 w-6" />
                                ) : (
                                    <Eye className="h-6 w-6" />
                                )}
                            </button>
                        </div>
                        <p className="text-sm text-gray-400 font-medium ml-2">
                            Su número de cédula es su contraseña predeterminada.
                        </p>
                    </div>

                    <motion.div variants={itemVariants}>
                        <Button
                            type="submit"
                            className="w-full bg-[#4cc253] hover:bg-[#3da342] text-white font-black py-4 rounded-[2rem] transition-all duration-300 transform active:scale-95 shadow-xl shadow-[#4cc253]/20 h-20 text-xl uppercase tracking-wider"
                            disabled={isLoading || !password}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-3">
                                    <div className="animate-spin h-6 w-6 border-4 border-white/20 border-t-white rounded-full" />
                                    <span>Entrando...</span>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center gap-3">
                                    <LogIn className="h-6 w-6" />
                                    <span>Iniciar Sesión</span>
                                </div>
                            )}
                        </Button>
                    </motion.div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-red-50 border border-red-100 text-red-600 p-6 rounded-[2rem] flex items-start gap-3"
                        >
                            <AlertCircle className="h-6 w-6 flex-shrink-0" />
                            <p className="font-bold text-sm tracking-tight">{error}</p>
                        </motion.div>
                    )}
                </motion.form>
            )}
        </AnimatePresence>
    )
}

export default LoginForm
