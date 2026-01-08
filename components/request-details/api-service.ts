/**
 * Servicio para obtener información de operadores y historial de solicitudes
 */

export interface OperatorInfo {
    nombre: string
    cargo: string
    zona: string
    operatorId: string
    email: string
    foto?: string
    cedula?: string
    fechaIngreso?: string
}

export interface HistoryItem {
    id: string
    type: string
    createdAt: string
    status: string
    description?: string
    requestedDates?: string
    noveltyType?: string
    requestId?: string
    requestType?: string
}

/**
 * Obtiene la información detallada de un operador por su código/cédula
 */
export async function fetchOperatorInfo(code: string): Promise<OperatorInfo | null> {
    try {
        const token = localStorage.getItem("accessToken")
        console.log("Obteniendo info del operador:", code)

        const response = await fetch(`/operator/info/${code}`, {
            headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        })

        console.log("Respuesta operador:", response.status)

        if (response.ok) {
            const data = await response.json()
            console.log("Datos del operador:", data)
            return data
        }

        console.warn("Error al obtener info del operador:", response.status)
        return null
    } catch (error) {
        console.error("Error en fetchOperatorInfo:", error)
        return null
    }
}

/**
 * Obtiene el historial completo de solicitudes de un usuario
 */
export async function fetchUserHistory(userCode: string): Promise<{
    history: HistoryItem[]
    error: string | null
}> {
    try {
        const token = localStorage.getItem("accessToken")

        const response = await fetch(
            `/api/admin/requests/user/${userCode}/history`,
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            }
        )

        if (response.ok) {
            const data = await response.json()
            console.log("Historial obtenido:", data.history?.length || 0, "registros")
            return {
                history: data.history || [],
                error: null,
            }
        }

        return {
            history: [],
            error: "No se pudo cargar el historial completo del usuario.",
        }
    } catch (error) {
        console.error("Error en fetchUserHistory:", error)
        return {
            history: [],
            error: "Error al cargar el historial completo.",
        }
    }
}

