import { UserPermit } from "./types"

/**
 * Servicios API para el módulo de solicitud de permisos
 */

/**
 * Obtiene todas las solicitudes del usuario actual
 */
export async function getUserPermits(): Promise<UserPermit[]> {
    try {
        const token = localStorage.getItem("accessToken")
        if (!token) {
            throw new Error("No se encontró el token de acceso")
        }

        const response = await fetch("/api/admin/solicitudes", {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`❌ API Error (getUserPermits): Status ${response.status}`, errorText)
            throw new Error(`Error al obtener solicitudes: ${response.status}`)
        }

        return await response.json()
    } catch (error) {
        console.error("Error al obtener solicitudes:", error)
        return []
    }
}

/**
 * Verifica si existen permisos para las fechas y tipo de novedad especificados
 */
export async function checkExistingPermits(dates: string[], noveltyType: string, userCode?: string): Promise<boolean> {
    try {
        const token = localStorage.getItem("accessToken")
        if (!token) {
            throw new Error("No se encontró el token de acceso")
        }

        const response = await fetch("/api/permits/check-existing-permits", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ dates, noveltyType, userCode }),
        })

        if (!response.ok) {
            throw new Error("Error al verificar permisos existentes")
        }

        const data = await response.json()
        return data.hasExistingPermit
    } catch (error) {
        console.error("Error al verificar permisos:", error)
        return false
    }
}

/**
 * Envía una solicitud de permiso al servidor
 */
export async function submitPermitRequest(formData: FormData, signal: AbortSignal) {
    const token = localStorage.getItem("accessToken")
    if (!token) {
        throw new Error("No se encontró el token de acceso")
    }

    const response = await fetch("/api/permits/permit-request", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal,
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Error desconocido" }))
        throw new Error(errorData.message || "Error al enviar la solicitud")
    }

    return response.json()
}

/**
 * Busca empleados por nombre o cédula
 */
export async function searchEmployees(query: string, signal?: AbortSignal) {
    try {
        const token = localStorage.getItem("accessToken")
        if (!token) {
            throw new Error("No se encontró el token de acceso")
        }

        const response = await fetch(`/api/employees/search?q=${encodeURIComponent(query)}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            signal,
        })

        if (!response.ok) {
            throw new Error("Error al buscar empleados")
        }

        return response.json()
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return { employees: [] }
        }
        console.error("Error al buscar empleados:", error)
        return { employees: [] }
    }
}

/**
 * Actualiza el número de teléfono del usuario
 */
export async function updateUserPhone(phone: string) {
    try {
        const token = localStorage.getItem("accessToken")
        if (!token) {
            throw new Error("No se encontró el token de acceso")
        }

        const response = await fetch("/api/user/phone", {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ phone }),
        })

        if (!response.ok) {
            throw new Error("Error al actualizar el teléfono")
        }

        return response.json()
    } catch (error) {
        console.error("Error al actualizar teléfono:", error)
        throw error
    }
}

