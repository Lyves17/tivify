"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const faqKeys = ["1", "2", "3", "4", "5", "6", "7"];

export default function HelpPage() {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <HelpCircle size={28} className="text-primary-400" />
        <h1 className="text-2xl font-bold text-dark-100">{t("help.title")}</h1>
      </div>

      <p className="text-dark-400 mb-6">
        {t("help.subtitle")}
      </p>

      <div className="space-y-3">
        {faqKeys.map((key, i) => (
          <div key={key} className="card">
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-dark-100 font-medium pr-4">
                {t(`help.q${key}`)}
              </span>
              {openIndex === i ? (
                <ChevronUp size={20} className="text-primary-400 shrink-0" />
              ) : (
                <ChevronDown size={20} className="text-dark-400 shrink-0" />
              )}
            </button>
            {openIndex === i && (
              <p className="mt-3 pt-3 border-t border-dark-700 text-dark-300 text-sm leading-relaxed">
                {t(`help.a${key}`)}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
