import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  History,
  Loader2,
  XCircle,
  TrendingUp,
  Calendar,
  Clock,
  CheckCircle,
  XIcon,
  AlertCircle,
  BarChart3,
  PieChart,
  Activity,
  Target,
  FileText,
  ShieldCheck,
  CalendarCheck
} from 'lucide-react';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Area,
  AreaChart
} from 'recharts';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

interface HistoryItem {
  id: string;
  type: string;
  status: 'created' | 'approved' | 'rejected' | 'pending' | 'notified';
  description?: string;
  requestedDates?: string;
  noveltyType?: string;
  createdAt: string;
}

interface HistorySectionProps {
  isLoading: boolean;
  error: string | null;
  history: HistoryItem[];
}

// Fixed Corporate Green
const CORPORATE_GREEN = '#4cc253';

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string;[key: string]: any }) => (
  <div className={`border border-gray-100 shadow-sm bg-white overflow-hidden rounded-3xl ${className}`} {...props}>
    {children}
  </div>
);

const formatDate = (dateString: string) => {
  if (!dateString) return "--";
  try {
    const date = parseISO(dateString);
    return format(date, 'dd/MM/yyyy', { locale: es });
  } catch {
    return dateString;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'approved': return 'bg-[#4cc253]/10 text-[#4cc253] border-[#4cc253]/20';
    case 'rejected': return 'bg-red-50 text-red-600 border-red-100';
    case 'pending': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'created': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'notified': return 'bg-purple-50 text-purple-600 border-purple-100';
    default: return 'bg-gray-50 text-gray-400 border-gray-100';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'approved': return 'Aprobada';
    case 'rejected': return 'Rechazada';
    case 'pending': return 'Pendiente';
    case 'created': return 'Creada';
    case 'notified': return 'Notificada';
    default: return status;
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'approved': return <CheckCircle className="w-4 h-4" />;
    case 'rejected': return <XIcon className="w-4 h-4" />;
    case 'pending': return <Clock className="w-4 h-4" />;
    case 'created': return <Calendar className="w-4 h-4" />;
    case 'notified': return <AlertCircle className="w-4 h-4" />;
    default: return <Activity className="w-4 h-4" />;
  }
};

const HistorySection = React.memo(({ isLoading, error, history }: HistorySectionProps) => {
  // Estadísticas
  const stats = useMemo(() => {
    const total = history.length;
    const approved = history.filter(h => h.status === 'approved').length;
    const rejected = history.filter(h => h.status === 'rejected').length;
    const pending = history.filter(h => h.status === 'pending').length;

    return {
      total,
      approved,
      rejected,
      pending,
      approvalRate: total > 0 ? (approved / total * 100) : 0
    };
  }, [history]);

  // Datos para gráfico de pie (Estado)
  const pieData = useMemo(() => {
    return [
      { name: 'Aprobadas', value: stats.approved, color: CORPORATE_GREEN },
      { name: 'Rechazadas', value: stats.rejected, color: '#ef4444' },
      { name: 'Pendientes', value: stats.pending, color: '#f59e0b' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // Distribución por Tipo de Novedad
  const typeDistribution = useMemo(() => {
    const counts: { [key: string]: number } = {};
    history.forEach(item => {
      const type = item.noveltyType || 'Otro';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({
        name,
        value,
        percentage: stats.total > 0 ? (value / stats.total * 100) : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [history, stats.total]);

  // Tendencias mensuales simplificadas
  const monthlyTrends = useMemo(() => {
    if (history.length === 0) return [];
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    return last6Months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthHistory = history.filter(item => {
        if (!item.createdAt) return false;
        try {
          const itemDate = parseISO(item.createdAt);
          return itemDate >= monthStart && itemDate <= monthEnd;
        } catch {
          return false;
        }
      });
      return {
        month: format(month, 'MMM', { locale: es }).toUpperCase(),
        total: monthHistory.length,
        approved: monthHistory.filter(h => h.status === 'approved').length,
      };
    });
  }, [history]);

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
        <Loader2 className="w-12 h-12 text-[#4cc253] animate-spin mb-4" />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Analizando historial profesional...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-red-50 rounded-3xl border border-dashed border-red-100">
        <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <p className="text-red-900 font-bold uppercase tracking-tight mb-1">Error al cargar historial</p>
        <p className="text-red-600 text-[10px] font-black uppercase tracking-widest">{error}</p>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
        <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-400 font-black text-sm uppercase tracking-widest">No hay historial disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Solicitudes', value: stats.total, icon: FileText, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Tasa Aprobación', value: `${stats.approvalRate.toFixed(0)}%`, icon: ShieldCheck, color: 'text-[#4cc253]', bg: 'bg-white' },
          { label: 'Pendientes', value: stats.pending, icon: Clock, color: 'text-amber-500', bg: 'bg-white' },
          { label: 'Aprobadas', value: stats.approved, icon: CalendarCheck, color: 'text-[#4cc253]', bg: 'bg-white' },
        ].map((item, idx) => (
          <Card key={idx} className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{item.label}</p>
                <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-xl">
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Type Distribution Card */}
        <Card className="lg:col-span-1 p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-gray-50 rounded-xl">
              <Target className="w-5 h-5 text-[#4cc253]" />
            </div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Tipos de Solicitud</h3>
          </div>

          <div className="space-y-6">
            {typeDistribution.map((item, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className="text-gray-500 truncate pr-4">{item.name}</span>
                  <span className="text-gray-900">{item.value} <span className="text-gray-400 font-bold">({item.percentage.toFixed(0)}%)</span></span>
                </div>
                <div className="h-2 w-full bg-gray-50 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: index * 0.1 }}
                    className="h-full bg-[#4cc253] rounded-full shadow-[0_0_8px_rgba(76,194,83,0.3)]"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pie Chart Card */}
        <Card className="lg:col-span-1 p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-gray-50 rounded-xl">
              <PieChart className="w-5 h-5 text-[#4cc253]" />
            </div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Estado Final</h3>
          </div>
          <div className="h-48 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontSize: '10px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <p className="text-xl font-black text-gray-900">{stats.total}</p>
                <p className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Total</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 mt-4">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest p-2 rounded-xl border border-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-gray-500">{item.name}</span>
                </div>
                <span className="text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* List Card */}
        <Card className="lg:col-span-2 p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="p-2 bg-gray-50 rounded-xl">
              <Activity className="w-5 h-5 text-[#4cc253]" />
            </div>
            <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Historial Detallado</h3>
          </div>
          <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {history.map((item, index) => (
              <motion.div
                key={item.id}
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="group p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-white hover:border-[#4cc253]/30 hover:shadow-sm transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-xl bg-white shadow-sm flex items-center justify-center ${getStatusColor(item.status).split(' ')[1]}`}>
                      {getStatusIcon(item.status)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="font-black text-gray-900 text-sm uppercase tracking-tight">{item.type}</h4>
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${getStatusColor(item.status)}`}>
                          {getStatusText(item.status)}
                        </span>
                      </div>
                      <div className="flex items-center space-x-3 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          {formatDate(item.createdAt)}
                        </span>
                        {item.requestedDates && (
                          <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {item.requestedDates.split(',').length} fecha(s)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <FileText className="w-4 h-4 text-gray-300" />
                  </div>
                </div>
                {item.description && (
                  <div className="mt-3 pl-12">
                    <p className="text-xs text-gray-500 font-medium leading-relaxed italic border-l-2 border-gray-100 pl-3">
                      "{item.description}"
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
});

HistorySection.displayName = "HistorySection";

export default HistorySection;