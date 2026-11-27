import React, { useState } from 'react';
import { Camera, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { ProjectImageRecord } from '../../types';
import { compressImageFile, ProcessedImageResult } from '../../utils/imageMedia';
import { formatFileSize } from '../../utils/format';

interface ProjectImageUploaderProps {
  projectTitle: string;
  currentImage?: ProjectImageRecord;
  onSaveImage: (processed: ProcessedImageResult) => Promise<void>;
  onDeleteImage: () => Promise<void>;
}

// Section 5: Dedicated Project Image component with storage picker, mobile camera capture, preview before save, replace & delete
export const ProjectImageUploader: React.FC<ProjectImageUploaderProps> = ({
  projectTitle,
  currentImage,
  onSaveImage,
  onDeleteImage,
}) => {
  const [pendingPreview, setPendingPreview] = useState<ProcessedImageResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      const processed = await compressImageFile(file, 1200, 0.82);
      setPendingPreview(processed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در پردازش تصویر');
    } finally {
      setProcessing(false);
      e.target.value = '';
    }
  };

  const handleConfirmSave = async () => {
    if (!pendingPreview) return;
    await onSaveImage(pendingPreview);
    setPendingPreview(null);
  };

  const displayDataUrl = pendingPreview?.dataUrl ?? currentImage?.dataUrl;

  return (
    <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-[#243B5A]">تصویر پروژه</h4>
          <p className="mt-0.5 text-[11px] text-[#5B6573]">
            متصل به شناسه اختصاصی همین پروژه؛ در داشبورد، فهرست پروژه‌ها، پرونده و پیش‌نمایش گزارش نمایش داده می‌شود.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>{currentImage ? 'تعویض از حافظه' : 'انتخاب از حافظه'}</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChosen}
              className="hidden"
            />
          </label>

          <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#263448] hover:bg-[#F2EEE6] cursor-pointer">
            <Camera className="h-3.5 w-3.5 text-[#354F73]" />
            <span>ثبت با دوربین</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChosen}
              className="hidden"
            />
          </label>

          {currentImage && !pendingPreview && (
            <button
              type="button"
              onClick={onDeleteImage}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D8B4B4] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>حذف تصویر</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-[#D8B4B4] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9E3B3B]">
          {error}
        </div>
      )}

      {processing ? (
        <div className="py-6 text-center text-xs text-[#5B6573]">در حال آماده‌سازی و فشرده‌سازی تصویر...</div>
      ) : displayDataUrl ? (
        <div className="space-y-2.5">
          <div className="overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FFFFFF] p-2">
            <img
              src={displayDataUrl}
              alt={`تصویر اختصاصی ${projectTitle}`}
              className="mx-auto max-h-60 w-auto max-w-full rounded object-contain"
            />
          </div>

          {pendingPreview ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C6D5C4] bg-[#E7ECE6] px-3.5 py-2.5 text-xs">
              <span className="text-[#263448]">
                پیش‌نمایش آماده ثبت ({formatFileSize(pendingPreview.sizeBytes)})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPreview(null)}
                  className="rounded border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1 text-xs text-[#263448] cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="rounded border border-[#243B5A] bg-[#243B5A] px-3.5 py-1 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  تأیید و ثبت تصویر پروژه
                </button>
              </div>
            </div>
          ) : (
            currentImage && (
              <div className="text-[11px] text-[#788290]">
                تصویر اختصاصی پروژه ثبت شده است · حجم ذخیره‌شده: {formatFileSize(currentImage.sizeBytes)}
              </div>
            )
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#CEC8BA] bg-[#FFFFFF] py-7 text-center text-[#788290]">
          <ImageIcon className="h-6 w-6 text-[#9BA3AE]" />
          <div className="text-xs">هنوز تصویر اختصاصی برای این پروژه ثبت نشده است.</div>
        </div>
      )}
    </div>
  );
};
