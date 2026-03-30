// ─────────────────────────────────────────────────────
// WeekCalendar — Barra de navegación semanal
// ─────────────────────────────────────────────────────
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

const DAY_LABELS = ["L", "M", "Mi", "J", "V", "S", "D"];

interface Props {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  datesWithEntries?: Set<string>; // "YYYY-MM-DD" strings
}

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  // Monday = 0 index
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - ((day + 6) % 7));

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function isSameDay(a: Date, b: Date): boolean {
  return formatDateKey(a) === formatDateKey(b);
}

export default function WeekCalendar({ selectedDate, onSelectDate, datesWithEntries }: Props) {
  const today = new Date();
  const weekDates = getWeekDates(selectedDate);

  const shiftWeek = (direction: -1 | 1) => {
    const next = new Date(selectedDate);
    next.setDate(next.getDate() + direction * 7);
    onSelectDate(next);
  };

  return (
    <View className="flex-row items-center justify-between mb-4 px-1">
      <TouchableOpacity onPress={() => shiftWeek(-1)} className="p-1">
        <Ionicons name="chevron-back" size={18} color="#A0A0B0" />
      </TouchableOpacity>

      {weekDates.map((date, idx) => {
        const isSelected = isSameDay(date, selectedDate);
        const isToday = isSameDay(date, today);
        const hasEntries = datesWithEntries?.has(formatDateKey(date));
        const isFuture = date > today && !isSameDay(date, today);

        return (
          <TouchableOpacity
            key={idx}
            onPress={() => !isFuture && onSelectDate(date)}
            className="items-center"
            style={{ opacity: isFuture ? 0.3 : 1 }}
          >
            <Text
              className={`text-xs mb-1 ${isToday ? "text-primary font-bold" : "text-text-muted"}`}
            >
              {DAY_LABELS[idx]}
            </Text>
            <View
              className={`w-9 h-9 rounded-full items-center justify-center ${
                isSelected
                  ? "bg-primary"
                  : isToday
                    ? "border border-primary"
                    : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  isSelected ? "text-white" : isToday ? "text-primary" : "text-white"
                }`}
              >
                {date.getDate()}
              </Text>
            </View>
            {/* Dot for entries */}
            <View className="h-1.5 mt-1">
              {hasEntries && !isSelected && (
                <View className="w-1.5 h-1.5 rounded-full bg-green-400" />
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <TouchableOpacity onPress={() => shiftWeek(1)} className="p-1">
        <Ionicons name="chevron-forward" size={18} color="#A0A0B0" />
      </TouchableOpacity>
    </View>
  );
}
