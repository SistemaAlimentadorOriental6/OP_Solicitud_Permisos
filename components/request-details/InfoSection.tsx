"use client"

import React from "react"
import {
    FileText,
    Type,
    Activity,
    Calendar as CalendarIcon,
    Clock,
    MessageSquare,
    Users,
    MapPin,
    Briefcase,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PersonalInfoCard } from "./PersonalInfoCard"
import { OperatorInfo } from "./api-service"
import { Request } from "./types"
import { formatDate, getStatusColor, getStatusText } from "./utils"

interface InfoSectionProps {
    request: Request
    operatorInfo: OperatorInfo | null
    isLoadingOperator: boolean
    onPhotoClick?: (photoUrl: string) => void
}

/**
 * Sección completa de información de la solicitud
 */
export const InfoSection = React.memo<InfoSectionProps>(
    ({ request, operatorInfo, isLoadingOperator, onPhotoClick }) => {
        return (
            <div className="space-y-6 min-h-[500px]">
                {/* Enhanced Personal Information */}
                <PersonalInfoCard
                    operatorInfo={operatorInfo}
                    request={request}
                    isLoading={isLoadingOperator}
                    onPhotoClick={onPhotoClick}
                />

                {/* Request Details */}
                <Card className="border border-gray-100 shadow-sm bg-white overflow-hidden rounded-3xl">
                    <div className="p-8">
                        <div className="flex items-center space-x-3 mb-8">
                            <div className="p-2 bg-gray-50 rounded-xl">
                                <FileText className="w-6 h-6 text-[#4cc253]" />
                            </div>
                            <h3 className="text-xl font-black text-gray-900 uppercase tracking-tighter">
                                Detalles de la Solicitud
                            </h3>
                        </div>

                        {/* Información Principal */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                                    <Type className="w-4 h-4 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Tipo</p>
                                    <p className="font-bold text-gray-900 capitalize">{request?.type || "--"}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                                    <Activity className="w-4 h-4 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Estado</p>
                                    <Badge
                                        className={`${getStatusColor(request?.status || "pending")} border-none px-2 text-[10px] font-black uppercase tracking-wider`}
                                    >
                                        {getStatusText(request?.status || "pending")}
                                    </Badge>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                                    <CalendarIcon className="w-4 h-4 text-gray-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Fecha Solicitud</p>
                                    <p className="font-bold text-gray-900">
                                        {request?.createdAt ? formatDate(request.createdAt) : "--"}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Hora Solicitud</p>
                                    <p className="font-bold text-gray-900 truncate">{request?.time || "--"}</p>
                                </div>
                            </div>

                            <div className="flex items-center space-x-4">
                                <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Zona / Ubicación</p>
                                    <p className="font-bold text-gray-900 truncate">{request?.zona || "--"}</p>
                                </div>
                            </div>

                            {((request as any).Turno || request?.shift) && (
                                <div className="flex items-center space-x-4">
                                    <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                                        <Briefcase className="w-4 h-4 text-gray-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Turno Pedido</p>
                                        <p className="font-bold text-gray-900 truncate">{(request as any).Turno || request?.shift}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Información de Pareja (Si aplica) */}
                        {(request?.type?.toLowerCase().includes('turno pareja') || (request as any)?.noveltyType?.toLowerCase().includes('turno pareja')) && (
                            <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">
                                    Información de Turno Pareja
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {((request as any).comp_am || request.codeAM) && (
                                        <div className="flex items-center space-x-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50 group hover:border-[#4cc253]/30 transition-all">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                                                <Users className="w-5 h-5 text-[#4cc253]" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest leading-none mb-1">Pareja AM</p>
                                                <p className="font-bold text-gray-900">{(request as any).comp_am || request.codeAM}</p>
                                            </div>
                                        </div>
                                    )}
                                    {((request as any).comp_pm || request.codePM) && (
                                        <div className="flex items-center space-x-4 bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50 group hover:border-[#4cc253]/30 transition-all">
                                            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-gray-100 shadow-sm group-hover:scale-110 transition-transform">
                                                <Users className="w-5 h-5 text-[#4cc253]" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest leading-none mb-1">Pareja PM</p>
                                                <p className="font-bold text-gray-900">{(request as any).comp_pm || request.codePM}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Rango de Fechas Solicitadas */}
                        <div className="mb-8">
                            <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">
                                Rango de Fechas Solicitadas
                            </h4>
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-wrap gap-3">
                                {request?.dates ? (
                                    Array.isArray(request?.dates) ? (
                                        request.dates.map((date: string, index: number) => (
                                            <div
                                                key={index}
                                                className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm"
                                            >
                                                <CalendarIcon className="w-4 h-4 text-[#4cc253]" />
                                                <span className="font-bold text-gray-800 text-sm">{formatDate(date)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                                            <CalendarIcon className="w-4 h-4 text-[#4cc253]" />
                                            <span className="font-bold text-gray-800 text-sm">
                                                {request?.dates ? formatDate(request.dates.toString()) : "--"}
                                            </span>
                                        </div>
                                    )
                                ) : (
                                    <p className="text-gray-400 italic text-sm">No hay fechas especificadas</p>
                                )}
                            </div>
                        </div>

                        {/* Respuesta del Administrador */}
                        {request?.reason && (
                            <div>
                                <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">
                                    Respuesta del Administrador
                                </h4>
                                <div className="bg-[#4cc253]/5 p-6 rounded-2xl border border-[#4cc253]/10">
                                    <div className="flex items-start space-x-3">
                                        <MessageSquare className="w-5 h-5 text-[#4cc253] mt-0.5" />
                                        <p className="text-gray-800 leading-relaxed font-medium">{request?.reason}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Description */}
                        {request?.description && (
                            <div className="mt-8 border-t border-gray-100 pt-8">
                                <h4 className="text-[10px] uppercase font-black text-gray-400 tracking-widest mb-4">
                                    Descripción de la Solicitud
                                </h4>
                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                    <p className="text-gray-800 leading-relaxed font-medium">{request?.description}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        )
    }
)

InfoSection.displayName = "InfoSection"
