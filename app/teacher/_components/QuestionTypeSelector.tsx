import React from "react";
import { tx } from "../../lib/theme";
import type { QuestionType } from "../../context/UserContext";

interface QuestionTypeSelectorProps {
  selectedType: QuestionType;
  onSelectType: (type: QuestionType) => void;
}

export function QuestionTypeSelector({ selectedType, onSelectType }: QuestionTypeSelectorProps) {
  const current = selectedType || "multiple_choice";
  const types: { value: QuestionType; label: string; subLabel: string; icon: string }[] = [
    { value: "multiple_choice", label: "ปรนัย 4 ชอยส์", subLabel: "Multiple Choice", icon: "✓" },
    { value: "fill_blank", label: "เติมคำตอบ", subLabel: "Fill in the Blank", icon: "___" },
    { value: "matching", label: "จับคู่คำตอบ", subLabel: "Matching", icon: "⇄" },
    { value: "essay", label: "อัตนัย / บรรยาย", subLabel: "Essay / Subjective", icon: "✍️" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      {types.map((type) => {
        const isSelected = current === type.value;
        return (
          <button
            key={type.value}
            type="button"
            onClick={() => onSelectType(type.value)}
            className={`py-2.5 px-3 rounded-2xl border text-center font-bold text-xs transition-all cursor-pointer animate-fadeIn btn-press flex sm:flex-col items-center justify-start sm:justify-center gap-2.5 sm:gap-1 ${
              isSelected
                ? "shadow-sm"
                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
            }`}
            style={
              isSelected
                ? { borderColor: tx.accent, color: tx.accent, backgroundColor: tx.accentBg }
                : { borderColor: tx.borderS, color: tx.secondary }
            }
          >
            <div className="text-base sm:text-lg font-mono w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
              {type.icon}
            </div>
            <div className="text-left sm:text-center flex-1 sm:flex-initial">
              <span className="block">{type.label}</span>
              <span className="block text-[10px] font-normal opacity-70">{type.subLabel}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
