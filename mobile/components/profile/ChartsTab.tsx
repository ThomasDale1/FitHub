// ─────────────────────────────────────────────────────
// mobile/components/profile/ChartsTab.tsx
// All 8 chart types with period selector
// Uses react-native-gifted-charts
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity, ActivityIndicator, ScrollView, Dimensions } from "react-native"
import { Ionicons } from "@expo/vector-icons"
import { useState, useEffect, useCallback } from "react"
import { BarChart, LineChart, PieChart } from "react-native-gifted-charts"
import { profileAPI, type ProfileChartData } from "@/lib/api"

const SCREEN_WIDTH = Dimensions.get("window").width - 40
const CHART_WIDTH = SCREEN_WIDTH - 32

// ─── Period Selector ─────────────────────────────────
const PERIODS = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "1y", label: "1A" },
  { key: "all", label: "Todo" },
]

function PeriodSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View className="flex-row gap-x-1 mb-3">
      {PERIODS.map(p => (
        <TouchableOpacity
          key={p.key}
          className={`flex-1 py-2 rounded-xl items-center ${value === p.key ? "bg-primary/20" : "bg-background-elevated"}`}
          onPress={() => onChange(p.key)}
        >
          <Text className={`text-xs font-bold ${value === p.key ? "text-primary" : "text-text-muted"}`}>
            {p.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

// ─── Chart Section Wrapper ───────────────────────────
function ChartSection({ title, icon, color, children }: {
  title: string; icon: keyof typeof Ionicons.glyphMap; color: string; children: React.ReactNode
}) {
  return (
    <View className="bg-background-card border border-background-elevated rounded-3xl p-4 mb-4">
      <View className="flex-row items-center gap-x-2 mb-3">
        <View className="rounded-xl p-1.5" style={{ backgroundColor: color + "20" }}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
        <Text className="text-white font-bold text-base">{title}</Text>
      </View>
      {children}
    </View>
  )
}

// ─── Individual Chart Components ─────────────────────

function HeatmapChart({ data }: { data: Record<string, { count: number; volume: number; duration: number }> }) {
  if (!data || typeof data !== "object") return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>
  const entries = Object.entries(data).sort(([a], [b]) => a.localeCompare(b))
  if (entries.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>

  const maxCount = Math.max(...entries.map(([, v]) => v.count), 1)

  // Show last 12 weeks as a grid (7 cols for days)
  const today = new Date()
  const weeks: string[][] = []
  for (let w = 11; w >= 0; w--) {
    const week: string[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(today)
      date.setDate(date.getDate() - (w * 7 + (6 - d)))
      week.push(date.toISOString().split("T")[0])
    }
    weeks.push(week)
  }

  return (
    <View>
      <View className="flex-row justify-between mb-1 px-1">
        {["L", "M", "X", "J", "V", "S", "D"].map(d => (
          <Text key={d} className="text-text-muted" style={{ fontSize: 8, width: 14, textAlign: "center" }}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} className="flex-row justify-between mb-1">
          {week.map((day, di) => {
            const entry = data[day]
            const intensity = entry ? Math.min(entry.count / maxCount, 1) : 0
            const bg = intensity === 0 ? "#1A1A2E" :
              intensity < 0.33 ? "#6C63FF30" :
              intensity < 0.66 ? "#6C63FF70" : "#6C63FF"
            return (
              <View
                key={di}
                style={{ width: 14, height: 14, borderRadius: 3, backgroundColor: bg }}
              />
            )
          })}
        </View>
      ))}
      <View className="flex-row items-center gap-x-2 mt-2 justify-center">
        <Text className="text-text-muted" style={{ fontSize: 9 }}>Menos</Text>
        {[0, 0.33, 0.66, 1].map((i, idx) => (
          <View key={idx} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: i === 0 ? "#1A1A2E" : i < 0.5 ? "#6C63FF30" : i < 0.8 ? "#6C63FF70" : "#6C63FF" }} />
        ))}
        <Text className="text-text-muted" style={{ fontSize: 9 }}>Más</Text>
      </View>
    </View>
  )
}

function VolumeChart({ data }: { data: Array<{ value: number; label: string }> }) {
  if (!data || data.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>
  const maxVal = Math.max(...data.map(d => d.value), 1)
  // Show only every Nth label to prevent overlap
  const labelStep = Math.max(1, Math.floor(data.length / 8))
  const barData = data.map((d, i) => ({
    value: d.value,
    label: i % labelStep === 0 ? d.label : "",
    frontColor: "#6C63FF",
    labelTextStyle: { color: "#6B6B80", fontSize: 8 },
  }))

  return (
    <BarChart
      data={barData}
      width={CHART_WIDTH - 40}
      height={160}
      barWidth={Math.max(6, Math.min(20, (CHART_WIDTH - 80) / data.length - 2))}
      spacing={2}
      noOfSections={4}
      yAxisColor="transparent"
      xAxisColor="#252540"
      yAxisTextStyle={{ color: "#6B6B80", fontSize: 9 }}
      hideRules
      isAnimated
      barBorderTopLeftRadius={3}
      barBorderTopRightRadius={3}
    />
  )
}

function StrengthChart({ data }: { data: Record<string, Array<{ value: number; date: string }>> }) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return <Text className="text-text-muted text-xs text-center py-4">Sin PRs registrados</Text>
  const exercises = Object.keys(data)
  if (exercises.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin PRs registrados</Text>

  const colors = ["#6C63FF", "#10B981", "#F59E0B", "#EF4444", "#EC4899"]

  return (
    <View>
      {exercises.slice(0, 5).map((ex, idx) => {
        const points = data[ex]
        if (points.length < 2) return null
        const lineData = points.map(p => ({ value: p.value, label: "" }))
        return (
          <View key={ex} className="mb-3">
            <View className="flex-row items-center gap-x-2 mb-1">
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[idx % colors.length] }} />
              <Text className="text-text-secondary text-xs capitalize flex-1">{ex}</Text>
              <Text className="text-white text-xs font-bold">{points[points.length - 1].value} kg</Text>
            </View>
            <LineChart
              data={lineData}
              width={CHART_WIDTH - 40}
              height={60}
              color={colors[idx % colors.length]}
              thickness={2}
              hideDataPoints
              hideYAxisText
              hideAxesAndRules
              curved
              areaChart
              startFillColor={colors[idx % colors.length]}
              startOpacity={0.2}
              endOpacity={0}
              isAnimated
            />
          </View>
        )
      })}
    </View>
  )
}

function MuscleChart({ data }: { data: Array<{ name: string; value: number }> }) {
  if (!data || data.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>

  const colors = ["#6C63FF", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#06B6D4", "#8B5CF6", "#F97316"]
  const pieData = data.slice(0, 8).map((d, i) => ({
    value: d.value,
    color: colors[i % colors.length],
    text: `${d.value}%`,
    textColor: "white",
    textSize: 9,
  }))

  return (
    <View className="flex-row items-center">
      <PieChart
        data={pieData}
        radius={70}
        donut
        innerRadius={40}
        innerCircleColor="#1A1A2E"
        centerLabelComponent={() => (
          <Text className="text-white text-xs font-bold text-center">Músculos</Text>
        )}
      />
      <View className="flex-1 ml-4">
        {data.slice(0, 8).map((d, i) => (
          <View key={d.name} className="flex-row items-center gap-x-2 mb-1">
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[i % colors.length] }} />
            <Text className="text-text-secondary text-xs capitalize flex-1">{d.name}</Text>
            <Text className="text-white text-xs font-bold">{d.value}%</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

function StepsChart({ data }: { data: Array<{ value: number; label: string; goal: number }> }) {
  if (!data || data.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>

  const labelStep = Math.max(1, Math.floor(data.length / 6))
  const lineData = data.map((d, i) => ({
    value: d.value,
    label: i % labelStep === 0 ? d.label : "",
    labelTextStyle: { color: "#6B6B80", fontSize: 8 },
  }))

  const avgGoal = data.length > 0 ? Math.round(data.reduce((s, d) => s + d.goal, 0) / data.length) : 0

  return (
    <View>
      <LineChart
        data={lineData}
        width={CHART_WIDTH - 40}
        height={160}
        color="#10B981"
        thickness={2}
        hideDataPoints
        yAxisColor="transparent"
        xAxisColor="#252540"
        yAxisTextStyle={{ color: "#6B6B80", fontSize: 9 }}
        noOfSections={4}
        hideRules
        curved
        areaChart
        startFillColor="#10B981"
        startOpacity={0.15}
        endOpacity={0}
        isAnimated
        showReferenceLine1
        referenceLine1Position={avgGoal}
        referenceLine1Config={{ color: "#F59E0B", dashWidth: 4, dashGap: 4, thickness: 1 }}
      />
      <View className="flex-row items-center justify-center gap-x-4 mt-2">
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 12, height: 2, backgroundColor: "#10B981" }} />
          <Text className="text-text-muted" style={{ fontSize: 9 }}>Pasos</Text>
        </View>
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 12, height: 2, backgroundColor: "#F59E0B", borderStyle: "dashed" }} />
          <Text className="text-text-muted" style={{ fontSize: 9 }}>Meta ({avgGoal.toLocaleString()})</Text>
        </View>
      </View>
    </View>
  )
}

function WeightChart({ data }: { data: Array<{ value: number; bodyFat: number | null; label: string }> }) {
  if (!data || data.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin registros</Text>

  const labelStep = Math.max(1, Math.floor(data.length / 6))
  const weightData = data.map((d, i) => ({
    value: d.value,
    label: i % labelStep === 0 ? d.label : "",
    labelTextStyle: { color: "#6B6B80", fontSize: 8 },
  }))

  const hasBF = data.some(d => d.bodyFat !== null)
  const bfData = hasBF ? data.map(d => ({ value: d.bodyFat || 0 })) : []

  return (
    <View>
      <LineChart
        data={weightData}
        data2={hasBF ? bfData : undefined}
        width={CHART_WIDTH - 40}
        height={160}
        color="#EC4899"
        color2="#06B6D4"
        thickness={2}
        hideDataPoints
        yAxisColor="transparent"
        xAxisColor="#252540"
        yAxisTextStyle={{ color: "#6B6B80", fontSize: 9 }}
        noOfSections={4}
        hideRules
        curved
        isAnimated
      />
      <View className="flex-row items-center justify-center gap-x-4 mt-2">
        <View className="flex-row items-center gap-x-1">
          <View style={{ width: 12, height: 2, backgroundColor: "#EC4899" }} />
          <Text className="text-text-muted" style={{ fontSize: 9 }}>Peso (kg)</Text>
        </View>
        {hasBF && (
          <View className="flex-row items-center gap-x-1">
            <View style={{ width: 12, height: 2, backgroundColor: "#06B6D4" }} />
            <Text className="text-text-muted" style={{ fontSize: 9 }}>Grasa (%)</Text>
          </View>
        )}
      </View>
    </View>
  )
}

function XPChart({ data }: { data: Array<{ value: number; label: string }> }) {
  if (!data || data.length === 0) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>

  const labelStep = Math.max(1, Math.floor(data.length / 6))
  const lineData = data.map((d, i) => ({
    value: d.value,
    label: i % labelStep === 0 ? d.label : "",
    labelTextStyle: { color: "#6B6B80", fontSize: 8 },
  }))

  return (
    <LineChart
      data={lineData}
      width={CHART_WIDTH - 40}
      height={160}
      color="#8B5CF6"
      thickness={2}
      hideDataPoints
      yAxisColor="transparent"
      xAxisColor="#252540"
      yAxisTextStyle={{ color: "#6B6B80", fontSize: 9 }}
      noOfSections={4}
      hideRules
      curved
      areaChart
      startFillColor="#8B5CF6"
      startOpacity={0.2}
      endOpacity={0}
      isAnimated
    />
  )
}

function MacrosChart({ data }: { data: { protein: { grams: number; percent: number }; carbs: { grams: number; percent: number }; fat: { grams: number; percent: number }; avgCalories: number } }) {
  if (!data || !data.protein || !data.carbs || !data.fat) return <Text className="text-text-muted text-xs text-center py-4">Sin datos</Text>

  const pieData = [
    { value: data.protein.percent, color: "#EF4444", text: `${data.protein.percent}%` },
    { value: data.carbs.percent, color: "#3B82F6", text: `${data.carbs.percent}%` },
    { value: data.fat.percent, color: "#F59E0B", text: `${data.fat.percent}%` },
  ]

  return (
    <View className="flex-row items-center">
      <PieChart
        data={pieData}
        radius={70}
        donut
        innerRadius={40}
        innerCircleColor="#1A1A2E"
        centerLabelComponent={() => (
          <View className="items-center">
            <Text className="text-white text-sm font-bold">{data.avgCalories}</Text>
            <Text className="text-text-muted" style={{ fontSize: 8 }}>kcal/día</Text>
          </View>
        )}
      />
      <View className="flex-1 ml-4">
        <View className="flex-row items-center gap-x-2 mb-2">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" }} />
          <Text className="text-text-secondary text-sm flex-1">Proteína</Text>
          <Text className="text-white text-sm font-bold">{data.protein.grams}g</Text>
          <Text className="text-text-muted text-xs ml-1">{data.protein.percent}%</Text>
        </View>
        <View className="flex-row items-center gap-x-2 mb-2">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#3B82F6" }} />
          <Text className="text-text-secondary text-sm flex-1">Carbos</Text>
          <Text className="text-white text-sm font-bold">{data.carbs.grams}g</Text>
          <Text className="text-text-muted text-xs ml-1">{data.carbs.percent}%</Text>
        </View>
        <View className="flex-row items-center gap-x-2">
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#F59E0B" }} />
          <Text className="text-text-secondary text-sm flex-1">Grasa</Text>
          <Text className="text-white text-sm font-bold">{data.fat.grams}g</Text>
          <Text className="text-text-muted text-xs ml-1">{data.fat.percent}%</Text>
        </View>
      </View>
    </View>
  )
}

// ═══════════════════════════════════════════════════════
// MAIN CHARTS TAB
// ═══════════════════════════════════════════════════════
interface ChartsTabProps {
  userId: string | null
}

type ChartType = "heatmap" | "volume" | "strength" | "muscle" | "steps" | "weight" | "xp" | "macros"

const CHART_TYPES: { key: ChartType; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { key: "heatmap", label: "Actividad", icon: "calendar-outline", color: "#6C63FF" },
  { key: "volume", label: "Volumen", icon: "barbell-outline", color: "#6C63FF" },
  { key: "strength", label: "Fuerza", icon: "trending-up-outline", color: "#10B981" },
  { key: "muscle", label: "Músculos", icon: "body-outline", color: "#EC4899" },
  { key: "steps", label: "Pasos", icon: "walk-outline", color: "#10B981" },
  { key: "weight", label: "Peso", icon: "scale-outline", color: "#EC4899" },
  { key: "xp", label: "XP", icon: "flash-outline", color: "#8B5CF6" },
  { key: "macros", label: "Macros", icon: "nutrition-outline", color: "#F59E0B" },
]

export default function ChartsTab({ userId }: ChartsTabProps) {
  const [period, setPeriod] = useState("3m")
  const [activeChart, setActiveChart] = useState<ChartType>("heatmap")
  const [chartData, setChartData] = useState<ProfileChartData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchChart = useCallback(async () => {
    if (!userId) return
    try {
      setLoading(true)
      const res = await profileAPI.getChart(userId, activeChart, period)
      setChartData(res.data)
    } catch (err) {
      console.error(`Chart ${activeChart} error:`, err)
      setChartData(null)
    } finally {
      setLoading(false)
    }
  }, [userId, activeChart, period])

  useEffect(() => { fetchChart() }, [fetchChart])

  const renderChart = () => {
    if (loading) return <ActivityIndicator color="#6C63FF" size="large" className="py-8" />
    const d = chartData?.data
    if (!d) return <Text className="text-text-muted text-xs text-center py-4">Sin datos disponibles</Text>

    switch (activeChart) {
      case "heatmap": return <HeatmapChart data={d} />
      case "volume": return <VolumeChart data={Array.isArray(d) ? d : []} />
      case "strength": return <StrengthChart data={d} />
      case "muscle": return <MuscleChart data={Array.isArray(d) ? d : []} />
      case "steps": return <StepsChart data={Array.isArray(d) ? d : []} />
      case "weight": return <WeightChart data={Array.isArray(d) ? d : []} />
      case "xp": return <XPChart data={Array.isArray(d) ? d : []} />
      case "macros": return <MacrosChart data={d} />
      default: return null
    }
  }

  const currentType = CHART_TYPES.find(t => t.key === activeChart)!

  return (
    <View>
      {/* Chart type selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
        <View className="flex-row gap-x-2">
          {CHART_TYPES.map(ct => {
            const isActive = activeChart === ct.key
            return (
              <TouchableOpacity
                key={ct.key}
                className={`flex-row items-center gap-x-1.5 px-3 py-2 rounded-xl ${isActive ? "bg-primary/20 border border-primary/40" : "bg-background-card border border-background-elevated"}`}
                onPress={() => setActiveChart(ct.key)}
              >
                <Ionicons name={ct.icon} size={14} color={isActive ? "#6C63FF" : "#6B6B80"} />
                <Text className={`text-xs font-semibold ${isActive ? "text-primary" : "text-text-muted"}`}>
                  {ct.label}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </ScrollView>

      {/* Period selector */}
      <PeriodSelector value={period} onChange={setPeriod} />

      {/* Chart */}
      <ChartSection title={currentType.label} icon={currentType.icon} color={currentType.color}>
        {renderChart()}
      </ChartSection>
    </View>
  )
}
