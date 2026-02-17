"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2, BookOpen } from "lucide-react"
import BottomNavigation from "@/components/BottomNavigation"
import useUserData from "../hooks/useUserData"

const PDF_URL = "/RG-RH 01 Reglamento Interno de Trabajo.pdf"
const PDFJS_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js"
const WORKER_CDN = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"

export default function ReglamentoPage() {
    const router = useRouter()
    const { userData, isLoading: isUserLoading } = useUserData()
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const renderTaskRef = useRef<any>(null)

    const [pdfDoc, setPdfDoc] = useState<any>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const [numPages, setNumPages] = useState(0)
    const [scale, setScale] = useState(1.5)
    const [loading, setLoading] = useState(true)
    const [rendering, setRendering] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Protect route
    useEffect(() => {
        if (!isUserLoading && !userData) {
            router.push("/")
        }
    }, [isUserLoading, userData, router])

    // Fit scale to container width on mount and resize
    useEffect(() => {
        const updateScale = () => {
            if (!containerRef.current) return
            const containerWidth = containerRef.current.clientWidth - 32 // padding
            // A4 page is ~595pt wide; base scale so it fills the container
            const fitScale = parseFloat((containerWidth / 595).toFixed(2))
            setScale(Math.min(Math.max(fitScale, 0.5), 3))
        }
        updateScale()
        window.addEventListener("resize", updateScale)
        return () => window.removeEventListener("resize", updateScale)
    }, [])

    // Load PDF.js and then the document
    useEffect(() => {
        if (!userData) return

        const loadEverything = async () => {
            try {
                setLoading(true)
                setError(null)

                if (!(window as any).pdfjsLib) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement("script")
                        script.src = PDFJS_CDN
                        script.onload = () => resolve()
                        script.onerror = () => reject(new Error("No se pudo cargar PDF.js"))
                        document.head.appendChild(script)
                    })
                }

                const pdfjsLib = (window as any).pdfjsLib
                pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_CDN

                const pdf = await pdfjsLib.getDocument(PDF_URL).promise
                setPdfDoc(pdf)
                setNumPages(pdf.numPages)
            } catch (err: any) {
                console.error("Error cargando PDF:", err)
                setError("No se pudo cargar el reglamento. Asegúrese de que el archivo existe en la carpeta pública.")
            } finally {
                setLoading(false)
            }
        }

        loadEverything()
    }, [userData])

    // Render current page
    const renderPage = useCallback(async () => {
        if (!pdfDoc || !canvasRef.current) return

        if (renderTaskRef.current) {
            renderTaskRef.current.cancel()
            renderTaskRef.current = null
        }

        setRendering(true)
        try {
            const page = await pdfDoc.getPage(currentPage)
            const viewport = page.getViewport({ scale })
            const canvas = canvasRef.current
            const ctx = canvas.getContext("2d")!

            canvas.height = viewport.height
            canvas.width = viewport.width

            const task = page.render({ canvasContext: ctx, viewport })
            renderTaskRef.current = task
            await task.promise
        } catch (err: any) {
            if (err?.name !== "RenderingCancelledException") {
                console.error("Error al renderizar página:", err)
            }
        } finally {
            setRendering(false)
        }
    }, [pdfDoc, currentPage, scale])

    useEffect(() => {
        renderPage()
    }, [renderPage])

    const handlePrevPage = () => setCurrentPage((p) => Math.max(1, p - 1))
    const handleNextPage = () => setCurrentPage((p) => Math.min(numPages, p + 1))
    const handleZoomIn = () => setScale((s) => Math.min(3, parseFloat((s + 0.25).toFixed(2))))
    const handleZoomOut = () => setScale((s) => Math.max(0.5, parseFloat((s - 0.25).toFixed(2))))

    // ─── Loading ──────────────────────────────────────────────────────────────
    if (isUserLoading || (loading && !pdfDoc)) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
                <div className="flex-1 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-9 h-9 text-[#4cc253] animate-spin" />
                    <p className="text-slate-400 text-sm">Cargando reglamento…</p>
                </div>
                <BottomNavigation />
            </div>
        )
    }

    // ─── Error ────────────────────────────────────────────────────────────────
    if (error) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
                <div className="flex-1 flex items-center justify-center p-6">
                    <div className="bg-white p-7 rounded-2xl shadow border border-slate-100 max-w-sm w-full text-center">
                        <div className="bg-red-50 w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4">
                            <BookOpen className="w-6 h-6 text-red-400" />
                        </div>
                        <h2 className="text-base font-bold text-slate-800 mb-1">Error al cargar</h2>
                        <p className="text-slate-500 text-sm mb-5">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-slate-800 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors w-full"
                        >
                            Reintentar
                        </button>
                    </div>
                </div>
                <BottomNavigation />
            </div>
        )
    }

    // ─── Main ─────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-slate-50 flex flex-col pb-20">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                    <div className="bg-[#4cc253]/10 p-2 rounded-xl">
                        <BookOpen className="w-5 h-5 text-[#4cc253]" />
                    </div>
                    <div>
                        <h1 className="text-sm font-bold text-slate-800 leading-tight">Reglamento Interno</h1>
                        <p className="text-xs text-slate-400">
                            SAO6{numPages > 0 ? ` · ${numPages} páginas` : ""}
                        </p>
                    </div>
                </div>
            </header>

            {/* Controls bar */}
            <div className="sticky top-[57px] z-20 bg-white border-b border-slate-100 px-4 py-2">
                <div className="max-w-3xl mx-auto flex items-center justify-between">
                    {/* Pagination */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handlePrevPage}
                            disabled={currentPage <= 1}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="text-xs font-semibold text-slate-600 w-16 text-center tabular-nums">
                            {currentPage} / {numPages}
                        </span>
                        <button
                            onClick={handleNextPage}
                            disabled={currentPage >= numPages}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 transition-colors"
                        >
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>

                    {/* Zoom */}
                    <div className="flex items-center gap-1">
                        <button
                            onClick={handleZoomOut}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <ZoomOut className="w-4 h-4 text-slate-600" />
                        </button>
                        <span className="text-xs font-semibold text-slate-500 w-10 text-center tabular-nums">
                            {Math.round(scale * 100)}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                            <ZoomIn className="w-4 h-4 text-slate-600" />
                        </button>
                    </div>
                </div>
            </div>

            {/* PDF area */}
            <main
                ref={containerRef}
                className="flex-1 flex flex-col items-center p-3 sm:p-6 overflow-x-auto"
            >
                <div className="relative bg-white rounded-xl shadow border border-slate-200 overflow-hidden w-fit max-w-full">
                    {rendering && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/70 z-10">
                            <Loader2 className="w-5 h-5 text-[#4cc253] animate-spin" />
                        </div>
                    )}
                    <canvas ref={canvasRef} className="block max-w-full h-auto" />
                </div>
            </main>

            <BottomNavigation />
        </div>
    )
}