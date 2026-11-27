import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  FileText,
  FolderKanban,
  Home,
  Layers,
  Link2,
  ListChecks,
  Search,
  ShieldCheck,
  Target,
  Wallet,
  X,
} from 'lucide-react';
import {
  HELP_SECTIONS,
  HelpSectionGuide,
  HelpSectionId,
  OPERATING_PRINCIPLES,
} from './helpContent';
import { toPersianDigits } from '../../utils/format';

interface HelpCenterViewProps {
  initialSection?: HelpSectionId | null;
  onSectionChange?: (section: HelpSectionId | null) => void;
}

const SECTION_ICONS: Record<HelpSectionId, React.ComponentType<{ className?: string }>> = {
  dashboard: Home,
  projects: FolderKanban,
  budget: Wallet,
  actions: CheckSquare,
  documents: FileText,
  reports: BarChart3,
};

function normalizePersianSearch(input: string): string {
  return input
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export const HelpCenterView: React.FC<HelpCenterViewProps> = ({
  initialSection = null,
  onSectionChange,
}) => {
  const [openSectionIds, setOpenSectionIds] = useState<HelpSectionId[]>(
    initialSection ? [initialSection] : []
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [openPrincipleIds, setOpenPrincipleIds] = useState<string[]>([]);

  const sectionRefs = useRef<Partial<Record<HelpSectionId, HTMLDivElement | null>>>({});

  // Auto-open and smoothly focus on the requested section when navigated via a page's "?" icon
  useEffect(() => {
    if (initialSection) {
      setOpenSectionIds([initialSection]);
      const timer = setTimeout(() => {
        const el = sectionRefs.current[initialSection];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 120);
      return () => clearTimeout(timer);
    }
    setOpenSectionIds([]);
  }, [initialSection]);

  const handleToggleSection = (id: HelpSectionId) => {
    const isCurrentlyOpen = openSectionIds.includes(id);
    const nextIds = isCurrentlyOpen
      ? openSectionIds.filter((item) => item !== id)
      : [id];
    setOpenSectionIds(nextIds);
    onSectionChange?.(nextIds[0] ?? null);

    if (!isCurrentlyOpen) {
      setTimeout(() => {
        const el = sectionRefs.current[id];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 60);
    }
  };

  const togglePrinciple = (id: string) => {
    setOpenPrincipleIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const normalizedQuery = useMemo(() => normalizePersianSearch(searchQuery), [searchQuery]);

  const filteredSections = useMemo(() => {
    if (!normalizedQuery) return HELP_SECTIONS;
    return HELP_SECTIONS.filter((sec) => {
      const haystack = normalizePersianSearch(
        [
          sec.title,
          sec.shortSummary,
          sec.purpose,
          sec.whatItDoes,
          ...sec.recordedInfo,
          ...sec.subsections.map((sub) => `${sub.title} ${sub.detail}`),
          ...sec.outputs,
          ...sec.connections,
          ...sec.howToUse,
          ...sec.notesAndLimitations,
        ].join(' ')
      );
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const filteredPrinciples = useMemo(() => {
    if (!normalizedQuery) return OPERATING_PRINCIPLES;
    return OPERATING_PRINCIPLES.filter((p) => {
      const haystack = normalizePersianSearch(`${p.title} ${p.summary} ${p.details}`);
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery]);

  const allSectionsOpen =
    filteredSections.length > 0 &&
    filteredSections.every((sec) => openSectionIds.includes(sec.id));

  const toggleAllSections = () => {
    if (allSectionsOpen) {
      setOpenSectionIds([]);
      onSectionChange?.(null);
    } else {
      setOpenSectionIds(filteredSections.map((sec) => sec.id));
    }
  };

  const allPrinciplesOpen =
    filteredPrinciples.length > 0 &&
    filteredPrinciples.every((p) => openPrincipleIds.includes(p.id));

  const toggleAllPrinciples = () => {
    if (allPrinciplesOpen) {
      setOpenPrincipleIds([]);
    } else {
      setOpenPrincipleIds(filteredPrinciples.map((p) => p.id));
    }
  };

  return (
    <div className="space-y-5">
      {/* Header + Standalone Topic Search */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 sm:p-5 space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4.5 w-4.5 text-[#B99A62]" />
              <h2 className="text-base font-bold text-[#1D3250]">
                مرکز راهنمای یکپارچه نرم‌افزار
              </h2>
            </div>
            <p className="text-xs leading-6 text-[#5B6573]">
              تمامی توضیحات، زیربخش‌ها، روش صحیح استفاده و نکات مهم شش بخش اصلی برنامه به‌صورت متمرکز در کارت‌های زیر قرار دارد.
            </p>
          </div>

          {filteredSections.length > 0 && (
            <button
              type="button"
              onClick={toggleAllSections}
              className="rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-1.5 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              {allSectionsOpen ? 'بستن همه کارت‌ها' : 'باز کردن همه کارت‌ها'}
            </button>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#788290]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && searchQuery) setSearchQuery('');
            }}
            placeholder="جست‌وجو در تمام بخش‌ها، زیربخش‌ها، نکات و اصول کار با نرم‌افزار..."
            aria-label="جست‌وجو در موضوعات راهنما"
            className="h-9 w-full rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] pr-9 pl-9 text-xs text-[#263448] focus:border-[#243B5A] focus:bg-[#FFFFFF] focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#788290] hover:bg-[#E8E5DE] hover:text-[#243B5A] cursor-pointer"
              aria-label="پاک کردن جست‌وجوی راهنما"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </section>

      {/* Six Interactive Accordion Cards for the 6 Core Sections */}
      <section aria-label="شش بخش اصلی نرم‌افزار" className="space-y-3">
        {filteredSections.length === 0 ? (
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-6 text-center text-xs text-[#788290]">
            بخشی مطابق با عبارت «{searchQuery}» یافت نشد.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredSections.map((sec) => {
              const Icon = SECTION_ICONS[sec.id];
              const isOpen = openSectionIds.includes(sec.id);
              return (
                <div
                  key={sec.id}
                  ref={(el) => {
                    sectionRefs.current[sec.id] = el;
                  }}
                  className={`scroll-mt-20 overflow-hidden rounded-[var(--app-radius)] border bg-[#FFFFFF] transition-colors ${
                    isOpen
                      ? 'border-[#243B5A] shadow-[0_6px_18px_rgba(29,50,80,0.08)]'
                      : 'border-[#E2DDD2] hover:border-[#B9B2A3]'
                  }`}
                >
                  {/* Interactive Accordion Card Header */}
                  <button
                    type="button"
                    onClick={() => handleToggleSection(sec.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full items-center justify-between gap-3 p-4 text-right transition-colors cursor-pointer ${
                      isOpen ? 'bg-[#F5F7FB]' : 'bg-[#FFFFFF] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <span
                        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                          isOpen
                            ? 'border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                            : 'border-[#E2DDD2] bg-[#FAF8F3] text-[#243B5A]'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium text-[#788290]">
                            بخش {toPersianDigits(sec.order)}
                          </span>
                          <h3 className="text-sm font-bold text-[#1D3250]">{sec.title}</h3>
                          <span className="rounded-md border border-[#E2DDD0] bg-[#FAF8F3] px-2 py-0.5 text-[10px] text-[#5B6573]">
                            {toPersianDigits(sec.subsections.length)} زیربخش
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-[#5B6573]">
                          {sec.shortSummary}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                        isOpen
                          ? 'border-[#243B5A] bg-[#FFFFFF] text-[#243B5A]'
                          : 'border-[#E5E0D5] bg-[#FAF8F3] text-[#5B6573]'
                      }`}
                    >
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </span>
                  </button>

                  {/* Accordion Body: Complete 9-Part Guide */}
                  {isOpen && <SectionGuideBody section={sec} />}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Independent Bottom Section: اصول کار با نرم‌افزار (8 Core Principles) */}
      <section
        aria-label="اصول کار با نرم‌افزار"
        className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFECE4] pb-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#B99A62]" />
              <h3 className="text-sm font-bold text-[#1D3250]">اصول کار با نرم‌افزار</h3>
            </div>
            <p className="text-xs text-[#5B6573]">
              قواعد پایه ذخیره‌سازی محلی، پشتیبان‌گیری، انتقال فایل JSON و کنترل صحت اطلاعات.
            </p>
          </div>

          {filteredPrinciples.length > 0 && (
            <button
              type="button"
              onClick={toggleAllPrinciples}
              className="rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-1.5 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              {allPrinciplesOpen ? 'بستن همه' : 'باز کردن همه'}
            </button>
          )}
        </div>

        {filteredPrinciples.length === 0 ? (
          <div className="py-4 text-center text-xs text-[#788290]">
            موردی مطابق با عبارت جست‌وجو یافت نشد.
          </div>
        ) : (
          <div className="divide-y divide-[#EFECE4] rounded-xl border border-[#ECE7DC]">
            {filteredPrinciples.map((principle) => {
              const isOpen = openPrincipleIds.includes(principle.id);
              return (
                <div
                  key={principle.id}
                  className="bg-[#FFFFFF] first:rounded-t-xl last:rounded-b-xl"
                >
                  <button
                    type="button"
                    onClick={() => togglePrinciple(principle.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right transition-colors hover:bg-[#FAF8F3] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-[#1D3250]">
                        {toPersianDigits(principle.number)}. {principle.title}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-5 text-[#5B6573]">
                        {principle.summary}
                      </div>
                    </div>
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E0D5] bg-[#FAF8F3] text-[#243B5A]">
                      {isOpen ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="border-t border-[#EFECE4] bg-[#FAF8F3]/75 px-4 py-3 text-xs leading-7 text-[#263448]">
                      {principle.details}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

const SectionGuideBody: React.FC<{ section: HelpSectionGuide }> = ({ section }) => {
  return (
    <div className="border-t border-[#E2DDD2] bg-[#FFFFFF] p-4 sm:p-5 space-y-4">
      {/* Purpose + What It Does */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#243B5A]">
            <Target className="h-3.5 w-3.5 text-[#B99A62]" />
            <span>هدف و کاربرد</span>
          </div>
          <p className="text-xs leading-7 text-[#263448]">{section.purpose}</p>
        </div>

        <div className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#243B5A]">
            <CheckCircle2 className="h-3.5 w-3.5 text-[#3D6B59]" />
            <span>چه کاری انجام می‌دهد؟</span>
          </div>
          <p className="text-xs leading-7 text-[#263448]">{section.whatItDoes}</p>
        </div>
      </div>

      {/* Recorded Information */}
      <div className="space-y-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
          <FileText className="h-3.5 w-3.5 text-[#354F73]" />
          <span>چه اطلاعاتی در این بخش ثبت می‌شود؟</span>
        </h4>
        <ul className="list-disc list-inside space-y-1.5 text-xs leading-7 text-[#263448] pr-1">
          {section.recordedInfo.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Subsections & Capabilities */}
      <div className="space-y-2">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
          <Layers className="h-3.5 w-3.5 text-[#354F73]" />
          <span>
            زیربخش‌ها و امکانات ({toPersianDigits(section.subsections.length)} مورد)
          </span>
        </h4>
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {section.subsections.map((sub, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] p-3 space-y-1"
            >
              <div className="text-xs font-semibold text-[#1D3250]">{sub.title}</div>
              <p className="text-xs leading-6 text-[#5B6573]">{sub.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outputs + Connections */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
            <BarChart3 className="h-3.5 w-3.5 text-[#354F73]" />
            <span>خروجی‌ها و اطلاعات ارائه‌شده</span>
          </h4>
          <ul className="list-disc list-inside space-y-1.5 text-xs leading-7 text-[#263448] pr-1">
            {section.outputs.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
            <Link2 className="h-3.5 w-3.5 text-[#354F73]" />
            <span>ارتباط با سایر بخش‌ها</span>
          </h4>
          <ul className="list-disc list-inside space-y-1.5 text-xs leading-7 text-[#263448] pr-1">
            {section.connections.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Proper Usage */}
      <div className="space-y-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
          <ListChecks className="h-3.5 w-3.5 text-[#3D6B59]" />
          <span>روش صحیح استفاده</span>
        </h4>
        <ol className="list-decimal list-inside space-y-1.5 text-xs leading-7 text-[#263448] pr-1">
          {section.howToUse.map((step, idx) => (
            <li key={idx}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Important Notes & Limitations */}
      <div className="rounded-xl border border-[#E2D4B7] bg-[#FDFBF6] p-3.5 space-y-1.5">
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-[#8B6B2E]">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>نکات مهم و محدودیت‌ها</span>
        </h4>
        <ul className="list-disc list-inside space-y-1.5 text-xs leading-7 text-[#263448] pr-1">
          {section.notesAndLimitations.map((note, idx) => (
            <li key={idx}>{note}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
