import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Image as ImageIcon,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import { GolzarImageRecord } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { compressImageFile } from '../../utils/imageMedia';
import { formatFileSize, generateId, toPersianDigits } from '../../utils/format';
import { ProjectImageUploader } from '../projects/ProjectImageUploader';

interface MediaManagerViewProps {
  store: AppStore;
}

export const MediaManagerView: React.FC<MediaManagerViewProps> = ({ store }) => {
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(store.projects[0]?.id ?? '');

  const handleAddGolzarImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setError('');
    setBusy(true);
    try {
      let nextOrder =
        store.golzarImages.length > 0
          ? Math.max(...store.golzarImages.map((g) => g.order)) + 1
          : 1;

      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        const compressed = await compressImageFile(file, 1400, 0.84);
        const now = new Date().toISOString();
        const record: GolzarImageRecord = {
          id: generateId('golzar'),
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          dataUrl: compressed.dataUrl,
          caption: caption.trim() || compressed.fileName,
          order: nextOrder++,
          sizeBytes: compressed.sizeBytes,
          createdAt: now,
          updatedAt: now,
          updatedByDevice: store.settings.deviceId,
        };
        await store.saveGolzarImage(record, true);
      }
      setCaption('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'افزودن تصویر گلزار با خطا مواجه شد.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleReplaceGolzarImage = async (
    target: GolzarImageRecord,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, 1400, 0.84);
      await store.saveGolzarImage(
        {
          ...target,
          fileName: compressed.fileName,
          mimeType: compressed.mimeType,
          dataUrl: compressed.dataUrl,
          sizeBytes: compressed.sizeBytes,
        },
        false
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'جایگزینی تصویر با خطا مواجه شد.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleMoveOrder = async (index: number, delta: -1 | 1) => {
    const list = [...store.golzarImages];
    const swapIdx = index + delta;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const current = list[index];
    const other = list[swapIdx];
    await store.saveGolzarImage({ ...current, order: other.order }, false);
    await store.saveGolzarImage({ ...other, order: current.order }, false);
  };

  const handleUploadOfficialLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setBusy(true);
    try {
      const compressed = await compressImageFile(file, 512, 0.9);
      await store.saveSettings({
        ...store.settings,
        officialLogoDataUrl: compressed.dataUrl,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'بارگذاری آرم رسمی با خطا مواجه شد.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleRemoveOfficialLogo = async () => {
    await store.saveSettings({
      ...store.settings,
      officialLogoDataUrl: undefined,
    });
  };

  const selectedProject =
    store.projects.find((p) => p.id === selectedProjectId) ?? store.projects[0];
  const selectedProjectImage = selectedProject
    ? store.projectImages.find((img) => img.projectId === selectedProject.id)
    : undefined;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9E3B3B]">
          {error}
        </div>
      )}

      {/* 1. Golzar Shohada Rotating Gallery Management */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E8E5DE] pb-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
              <ImageIcon className="h-4 w-4 text-[#B99A62]" />
              <span>مدیریت تصاویر گلزار شهدا (نمایش چرخشی صفحه اصلی)</span>
            </h3>
            <p className="mt-1 text-xs leading-6 text-[#5B6573]">
              تصاویر واقعی گلزار شهدا را از حافظه دستگاه انتخاب کنید. این تصاویر صرفاً در حافظه
              محلی (IndexedDB) ذخیره شده، در داشبورد هر ۱۰ ثانیه به‌صورت چرخشی نمایش داده می‌شوند
              و در خروجی JSON و پشتیبان ZIP منتقل می‌گردند.
            </p>
          </div>
          <span className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] px-3 py-1 text-xs tabular-nums text-[#243B5A]">
            {toPersianDigits(store.golzarImages.length)} تصویر ثبت‌شده
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-[#5B6573]">
              عنوان یا شرح کوتاه تصویر (اختیاری)
            </label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="مثال: نمای قطعه شهدای گمنام — پاییز ۱۴۰۴"
              className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
            />
          </div>
          <div className="flex items-end">
            <label className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer">
              <Plus className="h-4 w-4" />
              <span>{busy ? 'در حال پردازش...' : 'افزودن تصویر گلزار'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={handleAddGolzarImages}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {store.golzarImages.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#D7D2C6] bg-[#FAF8F3] p-6 text-center text-xs text-[#788290]">
            هنوز تصویری برای گلزار شهدا بارگذاری نشده است. هیچ تصویر اینترنتی یا ساختگی جایگزین
            نمی‌شود.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {store.golzarImages.map((img, index) => (
              <div
                key={img.id}
                className="overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FAF8F3]"
              >
                <div className="aspect-[16/10] w-full bg-[#ECE8DF]">
                  <img
                    src={img.dataUrl}
                    alt={img.caption || img.fileName}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="p-3 space-y-2">
                  <div className="truncate text-xs font-medium text-[#263448]">
                    {img.caption || img.fileName}
                  </div>
                  <div className="text-[11px] tabular-nums text-[#788290]">
                    ترتیب نمایش: {toPersianDigits(index + 1)} · {formatFileSize(img.sizeBytes)}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-[#E8E5DE]">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveOrder(index, -1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#243B5A] disabled:opacity-35 cursor-pointer"
                        title="انتقال به جلو"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === store.golzarImages.length - 1}
                        onClick={() => handleMoveOrder(index, 1)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#243B5A] disabled:opacity-35 cursor-pointer"
                        title="انتقال به عقب"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="inline-flex items-center gap-1 rounded border border-[#D7D2C6] bg-[#FFFFFF] px-2 py-1 text-[11px] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer">
                        <RefreshCw className="h-3 w-3" />
                        <span>جایگزینی</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleReplaceGolzarImage(img, e)}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => store.deleteGolzarImage(img)}
                        className="inline-flex items-center gap-1 rounded border border-[#D8B4B4] bg-[#FFFFFF] px-2 py-1 text-[11px] text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. Per-Project Dedicated Image Management */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
        <div className="border-b border-[#E8E5DE] pb-3">
          <h3 className="text-sm font-semibold text-[#243B5A]">
            مدیریت تصاویر اختصاصی پروژه‌ها
          </h3>
          <p className="mt-1 text-xs leading-6 text-[#5B6573]">
            هر پروژه می‌تواند یک تصویر اختصاصی ثبت‌شده در پرونده خود داشته باشد. تصویر هر پروژه
            به‌طور دقیق به همان پروژه متصل می‌ماند و برای پروژه‌های بدون تصویر، تصویر پروژه دیگر
            نمایش داده نمی‌شود.
          </p>
        </div>

        {store.projects.length === 0 ? (
          <div className="text-xs text-[#788290]">هنوز پرونده پروژه‌ای ثبت نشده است.</div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">انتخاب پروژه</label>
              <select
                value={selectedProject?.id ?? ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="w-full max-w-md rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
              >
                {store.projects.map((p) => {
                  const hasImg = store.projectImages.some((i) => i.projectId === p.id);
                  return (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.title} {hasImg ? '(دارای تصویر)' : '(بدون تصویر)'}
                    </option>
                  );
                })}
              </select>
            </div>

            {selectedProject && (
              <ProjectImageUploader
                projectTitle={selectedProject.title}
                currentImage={selectedProjectImage}
                onSaveImage={async (img) => {
                  await store.saveProjectImage(selectedProject.id, selectedProject.title, img);
                }}
                onDeleteImage={async () => {
                  await store.deleteProjectImage(selectedProject.id, selectedProject.title);
                }}
              />
            )}
          </div>
        )}
      </section>

      {/* 3. Official Logo Upload / Replace (Section 11) */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
        <div className="border-b border-[#E8E5DE] pb-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
            <Shield className="h-4 w-4 text-[#B99A62]" />
            <span>آرم رسمی دفتر فنی اداره گلزار شهدا</span>
          </h3>
          <p className="mt-1 text-xs leading-6 text-[#5B6573]">
            آرم فعلی در صورت عدم بارگذاری، صرفاً نشان موقت نرم‌افزار است. پس از دریافت فایل تصویر
            آرم رسمی کارفرما (PNG یا JPG)، آن را اینجا بارگذاری کنید تا با حفظ تناسب ابعاد در
            سربرگ صفحه و گزارش‌ها جایگزین شود.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] p-2">
            {store.settings.officialLogoDataUrl ? (
              <img
                src={store.settings.officialLogoDataUrl}
                alt="آرم رسمی دفتر فنی"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#243B5A] text-[#FAF8F3]">
                <span className="text-xs font-semibold">دفتر فنی</span>
                <span className="text-[10px] text-[#B99A62]">جایگاه موقت</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>
                {store.settings.officialLogoDataUrl ? 'تعویض آرم رسمی' : 'بارگذاری آرم رسمی'}
              </span>
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={handleUploadOfficialLogo}
                className="hidden"
              />
            </label>

            {store.settings.officialLogoDataUrl && (
              <button
                type="button"
                onClick={handleRemoveOfficialLogo}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#D8B4B4] bg-[#FFFFFF] px-3.5 py-2 text-xs text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>حذف و بازگشت به نشان موقت</span>
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
