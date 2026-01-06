import { format, addDays } from "date-fns"
import { es } from "date-fns/locale"
import { DateInfo } from "./types"

/**
 * Obtiene las iniciales de un nombre de usuario
 */
export function getInitials(userName: string | undefined): string {
    return userName
        ? userName
            .split(" ")
            .map((part) => part[0])
            .join("")
            .toUpperCase()
            .substring(0, 2)
        : "U"
}

/**
 * Obtiene el lunes de la semana actual
 */
export function getCurrentWeekMonday(): Date {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
}

/**
 * Verifica si una fecha es festivo
 */
export function isHoliday(date: Date): { isHoliday: boolean; name: string } {
    const holidays = [
        { month: 0, day: 1, name: "Año Nuevo" },
        { month: 4, day: 1, name: "Día del Trabajo" },
        { month: 6, day: 20, name: "Día de la Independencia" },
        { month: 7, day: 7, name: "Batalla de Boyacá" },
        { month: 11, day: 25, name: "Navidad" },
    ]

    const month = date.getMonth()
    const day = date.getDate()

    const holiday = holidays.find((h) => h.month === month && h.day === day)
    return holiday ? { isHoliday: true, name: holiday.name } : { isHoliday: false, name: "" }
}

/**
 * Obtiene los próximos festivos
 */
export function getUpcomingHolidays(dates: Date[]): Date[] {
    return dates.filter((date) => {
        const holiday = isHoliday(date)
        return holiday.isHoliday
    })
}

/**
 * Obtiene las fechas del calendario con festivos siguiendo la regla de negocio:
 * - Antes del miércoles 12:00 PM (Colombia): Muestra la siguiente semana.
 * - Después del miércoles 12:00 PM (Colombia): Muestra la subsiguiente semana.
 */
export function getCalendarDatesWithHolidays(): {
    regularDates: DateInfo[]
    upcomingHolidays: Date[]
} {
    const dates: DateInfo[] = []

    // 1. Obtener fecha y hora actual en Colombia (UTC-5)
    const now = new Date();
    const colombiaString = now.toLocaleString("en-US", { timeZone: "America/Bogota" });
    const colombiaNow = new Date(colombiaString);

    const bogotaDay = colombiaNow.getDay(); // 0 (Dom) a 6 (Sáb)
    const bogotaHour = colombiaNow.getHours();

    // 2. Obtener el lunes de la semana actual (de la fecha actual de Colombia)
    const currentMonday = new Date(colombiaNow);
    const diffToMonday = bogotaDay === 0 ? -6 : 1 - bogotaDay;
    currentMonday.setDate(colombiaNow.getDate() + diffToMonday);
    currentMonday.setHours(0, 0, 0, 0);

    // 3. Lógica de transición: Miércoles 12:00 PM
    // bogotaDay: Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6, Sun=0
    // Normalizamos domingo a 7 para facilitar la comparación
    const dayNormalized = bogotaDay === 0 ? 7 : bogotaDay;

    let weeksToAdd = 7; // Por defecto empezamos en la siguiente semana

    // Si es miércoles después de las 12, o jueves en adelante...
    if (dayNormalized > 3 || (dayNormalized === 3 && bogotaHour >= 12)) {
        weeksToAdd = 14; // Saltar a la semana subsiguiente
    }

    let startDate = new Date(currentMonday);
    startDate.setDate(currentMonday.getDate() + weeksToAdd);

    let currentDate = new Date(startDate);

    // 4. Generar los 7 días (Lunes a Domingo)
    for (let i = 0; i < 7; i++) {
        const formattedDate = format(currentDate, "yyyy-MM-dd")
        const shortDate = format(currentDate, "dd/MM")

        dates.push({
            date: new Date(currentDate),
            formattedDate,
            shortDate,
            dayName: format(currentDate, "EEEE", { locale: es }),
            dayNumber: format(currentDate, "d"),
            monthName: format(currentDate, "MMMM", { locale: es }),
            year: format(currentDate, "yyyy"),
        })
        currentDate = addDays(currentDate, 1)
    }

    return {
        regularDates: dates,
        upcomingHolidays: getUpcomingHolidays(dates.map((d) => d.date)),
    }
}

/**
 * Obtiene fechas del rango fijo (11 al 18 de agosto)
 */
export function getFixedRangeDates(): {
    regularDates: DateInfo[]
    upcomingHolidays: Date[]
} {
    const dates: DateInfo[] = []
    const startDate = new Date(new Date().getFullYear(), 7, 11) // 11 de agosto
    let currentDate = new Date(startDate)

    for (let i = 0; i < 8; i++) {
        const formattedDate = format(currentDate, "yyyy-MM-dd")
        const shortDate = format(currentDate, "dd/MM")

        dates.push({
            date: new Date(currentDate),
            formattedDate,
            shortDate,
            dayName: format(currentDate, "EEEE", { locale: es }),
            dayNumber: format(currentDate, "d"),
            monthName: format(currentDate, "MMMM", { locale: es }),
            year: format(currentDate, "yyyy"),
        })
        currentDate = addDays(currentDate, 1)
    }

    return {
        regularDates: dates,
        upcomingHolidays: getUpcomingHolidays(dates.map((d) => d.date)),
    }
}

/**
 * Obtiene fechas extemporáneas (desde hoy hasta 2 semanas adelante)
 */
export function getExtemporaneousDates(): {
    regularDates: DateInfo[]
    upcomingHolidays: Date[]
} {
    const dates: DateInfo[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let currentDate = new Date(today)

    for (let i = 0; i < 14; i++) {
        const formattedDate = format(currentDate, "yyyy-MM-dd")
        const shortDate = format(currentDate, "dd/MM")

        dates.push({
            date: new Date(currentDate),
            formattedDate,
            shortDate,
            dayName: format(currentDate, "EEEE", { locale: es }),
            dayNumber: format(currentDate, "d"),
            monthName: format(currentDate, "MMMM", { locale: es }),
            year: format(currentDate, "yyyy"),
        })
        currentDate = addDays(currentDate, 1)
    }

    return {
        regularDates: dates,
        upcomingHolidays: getUpcomingHolidays(dates.map((d) => d.date)),
    }
}

/**
 * Formatea tamaño de archivo
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i]
}

/**
 * Obtiene el tipo de archivo desde su nombre
 */
export function getFileType(filename: string): string {
    const extension = filename.split(".").pop()?.toLowerCase()
    if (!extension) return "Desconocido"

    const imageTypes = ["jpg", "jpeg", "png", "gif", "webp", "svg"]
    const docTypes = ["pdf", "doc", "docx"]

    if (imageTypes.includes(extension)) return "Imagen"
    if (docTypes.includes(extension)) return "Documento"

    return extension.toUpperCase()
}

/**
 * Obtiene la información de la fecha actual
 */
export function getTodayDateInfo(): DateInfo {
    const today = new Date()

    return {
        date: today,
        formattedDate: format(today, "yyyy-MM-dd"),
        shortDate: format(today, "dd/MM"),
        dayName: format(today, "EEEE", { locale: es }),
        dayNumber: format(today, "d"),
        monthName: format(today, "MMMM", { locale: es }),
        year: format(today, "yyyy"),
    }
}
