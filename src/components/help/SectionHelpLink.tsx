import React from 'react';
import { HelpCircle } from 'lucide-react';
import { HelpSectionId } from './helpContent';

const SECTION_TITLES: Record<HelpSectionId, string> = {
  dashboard: 'راهنمای داشبورد',
  projects: 'راهنمای پرونده پروژه‌ها',
  budget: 'راهنمای بودجه و اعتبارات',
  actions: 'راهنمای اقدامات و پیگیری‌ها',
  documents: 'راهنمای اسناد و مکاتبات',
  reports: 'راهنمای گزارش‌ها',
};

interface SectionHelpLinkProps {
  sectionId: HelpSectionId;
  onOpenHelp: (sectionId: HelpSectionId) => void;
}

export const SectionHelpLink: React.FC<SectionHelpLinkProps> = ({ sectionId, onOpenHelp }) => {
  const label = SECTION_TITLES[sectionId];
  return (
    <button
      type="button"
      onClick={() => onOpenHelp(sectionId)}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
    >
      <HelpCircle className="h-4 w-4 shrink-0" />
    </button>
  );
};
