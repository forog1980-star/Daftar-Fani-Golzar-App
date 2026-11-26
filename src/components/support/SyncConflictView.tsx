import React, { useEffect, useRef, useState } from 'react';
import { Download, Radio, Upload, Usb } from 'lucide-react';
import { SyncConflict, SyncEntityStore, SyncPackage } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  analyzeIncomingSyncPackage,
  applyApprovedSyncDecisions,
  buildSyncPackage,
  exportUsbSyncPackage,
  SyncAnalysisResult,
} from '../../utils/backupSync';
import { DirectWirelessPeer, WirelessState } from '../../utils/webrtcSync';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/format';

interface SyncConflictViewProps {
  store: AppStore;
}

const STORE_LABELS: Record<SyncEntityStore, string> = {
  projects: 'پرونده پروژه',
  budgets: 'بودجه و اعتبارات',
  payments: 'سابقه پرداخت',
  proposals: 'پیشنهاد بودجه',
  actions: 'اقدام و پیگیری',
  documents: 'سند / مکاتبه',
  people: 'اشخاص و امضاها',
  formTemplates: 'قالب فرم',
  formSubmissions: 'فرم تکمیل‌شده',
};

export const SyncConflictView: React.FC<SyncConflictViewProps> = ({ store }) => {
  const [analysis, setAnalysis] = useState<SyncAnalysisResult | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [importNewRecords, setImportNewRecords] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Direct Wireless P2P WebRTC state
  const peerRef = useRef<DirectWirelessPeer | null>(null);
  const [wirelessState, setWirelessState] = useState<WirelessState>('idle');
  const [wirelessMsg, setWirelessMsg] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [remoteOfferInput, setRemoteOfferInput] = useState('');
  const [answerCode, setAnswerCode] = useState('');
  const [remoteAnswerInput, setRemoteAnswerInput] = useState('');

  useEffect(() => {
    const peer = new DirectWirelessPeer(
      (st, msg) => {
        setWirelessState(st);
        setWirelessMsg(msg);
      },
      async (pkg) => {
        await processIncomingPackage(pkg);
      }
    );
    peerRef.current = peer;
    return () => {
      peer.close();
    };
  }, []);

  const processIncomingPackage = async (pkg: SyncPackage) => {
    setErrorMessage('');
    setStatusMessage('');
    try {
      const result = await analyzeIncomingSyncPackage(pkg);
      setAnalysis(result);
      setConflicts(result.conflicts);
      setStatusMessage(
        `بسته همگام‌سازی از «${result.sourceDeviceName}» تحلیل شد: ${toPersianDigits(result.newRecords.length)} رکورد جدید، ${toPersianDigits(result.identicalCount)} رکورد یکسان و ${toPersianDigits(result.conflicts.length)} تعارض شناسایی شد.`
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'خطا در تحلیل بسته همگام‌سازی');
    }
  };

  const handleUsbImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const pkg = JSON.parse(text) as SyncPackage;
      await processIncomingPackage(pkg);
    } catch {
      setErrorMessage('فایل انتخاب‌شده یک بسته همگام‌سازی معتبر (.dfsync.json) نیست.');
    } finally {
      e.target.value = '';
    }
  };

  const setConflictDecision = (
    conflictId: string,
    resolution: 'keep-local' | 'accept-remote' | 'keep-both'
  ) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolution } : c))
    );
  };

  const allConflictsResolved = conflicts.every((c) => Boolean(c.resolution));

  const handleApplySync = async () => {
    if (!analysis) return;
    if (!allConflictsResolved) {
      setErrorMessage('پیش از اعمال همگام‌سازی، لطفاً تکلیف تمام تعارض‌های نمایش‌داده‌شده را مشخص کنید.');
      return;
    }
    const res = await applyApprovedSyncDecisions(
      analysis,
      conflicts,
      importNewRecords,
      store.settings.deviceId
    );
    await store.saveSettings({
      ...store.settings,
      lastSyncAt: new Date().toISOString(),
    });
    await store.refresh();
    setAnalysis(null);
    setConflicts([]);
    setErrorMessage('');
    setStatusMessage(
      `همگام‌سازی کنترل‌شده انجام شد: ${toPersianDigits(res.added)} رکورد جدید افزوده شد، ${toPersianDigits(res.updated)} تعارض با نسخه دستگاه مقابل جایگزین شد، ${toPersianDigits(res.duplicated)} تعارض به‌صورت دو نسخه جداگانه حفظ شد و ${toPersianDigits(res.keptLocal)} مورد روی نسخه این دستگاه باقی ماند.`
    );
  };

  const handleSendWirelessPackage = async () => {
    try {
      const pkg = await buildSyncPackage(store.settings.deviceId, store.settings.deviceName, true);
      peerRef.current?.sendSyncPackage(pkg);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'ارسال بی‌سیم انجام نشد.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-4 text-xs leading-6 text-[#5B6268]">
        <strong className="text-[#2B3033]">معماری دو دستگاه هم‌سطح (بدون سرور ابری):</strong> گوشی و
        رایانه هم‌سطح هستند و هیچ‌یک دستگاه اصلی یا فرعی نیست. هنگام دریافت بسته همگام‌سازی، هر
        رکورد دارای تغییر متعارض برای تصمیم‌گیری صریح به کاربر نمایش داده می‌شود و هیچ‌گونه بازنویسی
        خاموش، ادغام بدون تأیید یا حذف خودکار انجام نخواهد شد.
      </div>

      {/* Method 1: USB / Direct File Transfer */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#2B3033]">
          <Usb className="h-4 w-4 text-[#2D5A63]" />
          <span>روش ۱: انتقال و همگام‌سازی از طریق کابل USB (فایل همگام‌سازی)</span>
        </div>
        <p className="text-xs leading-6 text-[#5B6268]">
          فایل بسته همگام‌سازی (<code>.dfsync.json</code>) را از یک دستگاه خروجی بگیرید، از طریق
          کابل USB به دستگاه دیگر منتقل کرده و در بخش زیر بارگذاری کنید تا بررسی تعارض‌ها انجام شود.
        </p>
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => exportUsbSyncPackage(store.settings.deviceId, store.settings.deviceName)}
            className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>خروجی بسته همگام‌سازی این دستگاه (USB)</span>
          </button>

          <label className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer">
            <Upload className="h-3.5 w-3.5 text-[#2D5A63]" />
            <span>ورود و بررسی بسته دستگاه مقابل</span>
            <input
              type="file"
              accept=".json,.dfsync.json"
              onChange={handleUsbImportFile}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Method 2: Direct Wireless Local Peer-to-Peer (WebRTC DataChannel, zero cloud server) */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#2B3033]">
            <Radio className="h-4 w-4 text-[#2D5A63]" />
            <span>روش ۲: ارتباط مستقیم بی‌سیم محلی (Wi-Fi / Hotspot بدون سرور ابری)</span>
          </div>
          <span className="text-xs text-[#5B6268]">
            وضعیت: {wirelessState === 'connected' ? 'متصل' : wirelessState === 'idle' ? 'آماده' : wirelessState}
          </span>
        </div>

        <p className="text-xs leading-6 text-[#5B6268]">
          برای انتقال مستقیم روی شبکه Wi-Fi یا هات‌اسپات مشترک بدون نیاز به اینترنت و سرور: در دستگاه اول «ایجاد کد اتصال» را بزنید، کد را به دستگاه دوم منتقل کنید، در دستگاه دوم «پذیرش کد و تولید پاسخ» را بزنید و کد پاسخ را در دستگاه اول ثبت کنید.
        </p>

        {wirelessMsg && (
          <div className="border border-[#E2DDD0] bg-[#FAF8F3] px-3 py-2 text-xs text-[#2D5A63]">
            {wirelessMsg}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Device A: Initiator */}
          <div className="border border-[#ECE7DA] bg-[#FAF8F3] p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-[#2B3033]">دستگاه شروع‌کننده اتصال</div>
            <button
              type="button"
              onClick={async () => {
                try {
                  const code = await peerRef.current!.createOfferCode();
                  setOfferCode(code);
                } catch {
                  setErrorMessage('ایجاد کد اتصال بی‌سیم در این مرورگر با خطا روبه‌رو شد.');
                }
              }}
              className="border border-[#2D5A63] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
            >
              ۱. ایجاد کد اتصال (Offer)
            </button>
            {offerCode && (
              <textarea
                readOnly
                rows={2}
                value={offerCode}
                className="w-full border border-[#CEC7B6] bg-[#FFFFFF] p-2 text-[11px] font-mono"
                dir="ltr"
              />
            )}
            <textarea
              rows={2}
              value={remoteAnswerInput}
              onChange={(e) => setRemoteAnswerInput(e.target.value)}
              placeholder="کد پاسخ (Answer) دریافت‌شده از دستگاه مقابل را اینجا وارد کنید..."
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] p-2 text-xs"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await peerRef.current?.completeConnectionWithAnswer(remoteAnswerInput);
                } catch {
                  setErrorMessage('کد پاسخ معتبر نیست.');
                }
              }}
              className="border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            >
              ۳. تکمیل اتصال با کد پاسخ
            </button>
          </div>

          {/* Device B: Responder */}
          <div className="border border-[#ECE7DA] bg-[#FAF8F3] p-3.5 space-y-2.5">
            <div className="text-xs font-semibold text-[#2B3033]">دستگاه پذیرنده اتصال</div>
            <textarea
              rows={2}
              value={remoteOfferInput}
              onChange={(e) => setRemoteOfferInput(e.target.value)}
              placeholder="کد اتصال (Offer) دستگاه اول را اینجا وارد کنید..."
              className="w-full border border-[#CEC7B6] bg-[#FFFFFF] p-2 text-xs"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  const ans = await peerRef.current!.acceptOfferAndCreateAnswerCode(remoteOfferInput);
                  setAnswerCode(ans);
                } catch {
                  setErrorMessage('کد اتصال واردشده معتبر نیست.');
                }
              }}
              className="border border-[#2D5A63] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
            >
              ۲. پذیرش کد و تولید کد پاسخ (Answer)
            </button>
            {answerCode && (
              <textarea
                readOnly
                rows={2}
                value={answerCode}
                className="w-full border border-[#CEC7B6] bg-[#FFFFFF] p-2 text-[11px] font-mono"
                dir="ltr"
              />
            )}
          </div>
        </div>

        {wirelessState === 'connected' && (
          <div className="pt-2">
            <button
              type="button"
              onClick={handleSendWirelessPackage}
              className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              ارسال مستقیم بسته همگام‌سازی به دستگاه متصل
            </button>
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="border border-[#D5DEC8] bg-[#F2F6EE] px-4 py-3 text-xs text-[#2D6A4F]">
          {statusMessage}
        </div>
      )}
      {errorMessage && (
        <div className="border border-[#DFC0C0] bg-[#FAF0F0] px-4 py-3 text-xs text-[#B43E3E]">
          {errorMessage}
        </div>
      )}

      {/* Conflict Resolution Workbench */}
      {analysis && (
        <div className="border border-[#2D5A63] bg-[#FFFFFF] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DDD0] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-[#2B3033]">
                بررسی و تصمیم‌گیری همگام‌سازی از «{analysis.sourceDeviceName}»
              </h4>
              <div className="mt-1 text-xs text-[#5B6268]">
                رکورد جدید: {toPersianDigits(analysis.newRecords.length)} · پیوست جدید:{' '}
                {toPersianDigits(analysis.newAttachments.length)} · یکسان:{' '}
                {toPersianDigits(analysis.identicalCount)} · تعارض نیازمند تصمیم:{' '}
                {toPersianDigits(conflicts.length)}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-[#2B3033] cursor-pointer">
              <input
                type="checkbox"
                checked={importNewRecords}
                onChange={(e) => setImportNewRecords(e.target.checked)}
                className="h-4 w-4 accent-[#2D5A63]"
              />
              <span>افزودن رکوردها و پیوست‌های جدید دستگاه مقابل</span>
            </label>
          </div>

          {conflicts.length === 0 ? (
            <div className="text-xs text-[#2D6A4F]">
              تعارضی میان داده‌های دو دستگاه مشاهده نشد. می‌توانید همگام‌سازی را تأیید کنید.
            </div>
          ) : (
            <div className="space-y-3">
              {conflicts.map((conf) => (
                <div key={conf.id} className="border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-[#B43E3E]">
                      تعارض در {STORE_LABELS[conf.store]}: {conf.recordLabel}
                    </div>
                    <div className="text-[11px] text-[#7C8287]">شناسه: {conf.recordId}</div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-3">
                      <div className="text-xs font-semibold text-[#2D5A63]">
                        نسخه این دستگاه ({formatJalaliDateTime(conf.localUpdatedAt)})
                      </div>
                      <pre
                        className="mt-2 max-h-36 overflow-auto text-[11px] text-[#5B6268]"
                        dir="ltr"
                      >
                        {JSON.stringify(conf.localRecord, null, 2)}
                      </pre>
                    </div>
                    <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-3">
                      <div className="text-xs font-semibold text-[#A66B1C]">
                        نسخه {conf.remoteDeviceName} ({formatJalaliDateTime(conf.remoteUpdatedAt)})
                      </div>
                      <pre
                        className="mt-2 max-h-36 overflow-auto text-[11px] text-[#5B6268]"
                        dir="ltr"
                      >
                        {JSON.stringify(conf.remoteRecord, null, 2)}
                      </pre>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {(
                      [
                        { val: 'keep-local', label: 'نگهداری نسخه این دستگاه' },
                        { val: 'accept-remote', label: 'پذیرش نسخه دستگاه مقابل' },
                        { val: 'keep-both', label: 'نگهداری هر دو به صورت جداگانه' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setConflictDecision(conf.id, opt.val)}
                        className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                          conf.resolution === opt.val
                            ? 'border border-[#2D5A63] bg-[#2D5A63] text-[#FAF8F3]'
                            : 'border border-[#CEC7B6] bg-[#FFFFFF] text-[#2B3033] hover:bg-[#ECE7DA]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 border-t border-[#E2DDD0] pt-3">
            <button
              type="button"
              onClick={() => {
                setAnalysis(null);
                setConflicts([]);
              }}
              className="border border-[#CEC7B6] px-4 py-2 text-xs"
            >
              انصراف بدون تغییر
            </button>
            <button
              type="button"
              disabled={!allConflictsResolved}
              onClick={handleApplySync}
              className="border border-[#2D5A63] bg-[#2D5A63] px-5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] disabled:opacity-50 cursor-pointer"
            >
              اعمال تصمیم‌های تأییدشده
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
