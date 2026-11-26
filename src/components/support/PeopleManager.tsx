import React, { useRef, useState } from 'react';
import { Edit2, Plus, RefreshCw, Upload, UserCheck, UserX } from 'lucide-react';
import { Person } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { generateId } from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';

interface PeopleManagerProps {
  store: AppStore;
}

export const PeopleManager: React.FC<PeopleManagerProps> = ({ store }) => {
  const [editing, setEditing] = useState<Person | null | undefined>(undefined);
  const [replacing, setReplacing] = useState<Person | null>(null);
  const [successorName, setSuccessorName] = useState('');
  const [successorRole, setSuccessorRole] = useState('');
  const [successorDept, setSuccessorDept] = useState('');

  const personMap = new Map(store.people.map((p) => [p.id, p]));

  const toggleActive = async (person: Person) => {
    await store.savePerson({ ...person, active: !person.active }, false);
  };

  const handleReplaceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacing || !successorName.trim()) return;
    const now = new Date().toISOString();
    const newPerson: Person = {
      id: generateId('per'),
      fullName: successorName.trim(),
      roleTitle: successorRole.trim() || replacing.roleTitle,
      department: successorDept.trim() || replacing.department,
      active: true,
      isSample: false,
      createdAt: now,
      updatedAt: now,
      updatedByDevice: store.settings.deviceId,
    };
    await store.savePerson(newPerson, true);
    await store.savePerson(
      {
        ...replacing,
        active: false,
        replacedByPersonId: newPerson.id,
        replacedAt: now,
      },
      false
    );
    setReplacing(null);
    setSuccessorName('');
    setSuccessorRole('');
    setSuccessorDept('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border border-[#E2DDD0] bg-[#FAF8F3] p-4">
        <div>
          <h3 className="text-sm font-semibold text-[#2B3033]">
            مدیریت پویا اشخاص، سمت‌ها و امضاها
          </h3>
          <p className="mt-1 text-xs leading-6 text-[#5B6268]">
            ویرایش، غیرفعال‌سازی یا جایگزینی اشخاص هیچ تغییری در نام و سمت ثبت‌شده در اسناد و فرم‌های تاریخی ایجاد نمی‌کند.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>افزودن شخص جدید</span>
        </button>
      </div>

      <div className="border border-[#E2DDD0] bg-[#FFFFFF] overflow-x-auto">
        {store.people.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7C8287]">
            شخصی ثبت نشده است.
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                <th className="px-4 py-3 font-medium">نام و نام خانوادگی</th>
                <th className="px-4 py-3 font-medium">سمت و واحد</th>
                <th className="px-4 py-3 font-medium">تصویر امضا</th>
                <th className="px-4 py-3 font-medium">وضعیت</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DA]">
              {store.people.map((person) => {
                const successor = person.replacedByPersonId
                  ? personMap.get(person.replacedByPersonId)
                  : undefined;
                return (
                  <tr key={person.id} className={person.active ? 'hover:bg-[#FAF8F3]' : 'bg-[#FAF8F3] opacity-75'}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#2B3033]">{person.fullName}</div>
                      {person.personnelCode && (
                        <div className="text-xs text-[#7C8287]">کد: {person.personnelCode}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="text-[#2B3033]">{person.roleTitle}</div>
                      <div className="text-[#7C8287]">{person.department}</div>
                    </td>
                    <td className="px-4 py-3">
                      {person.signatureImageDataUrl ? (
                        <img
                          src={person.signatureImageDataUrl}
                          alt={`امضای ${person.fullName}`}
                          className="h-9 max-w-[100px] border border-[#E2DDD0] bg-[#FAF8F3] object-contain p-0.5"
                        />
                      ) : (
                        <span className="text-xs text-[#7C8287]">ثبت‌نشده</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className={person.active ? 'font-medium text-[#2D6A4F]' : 'text-[#7C8287]'}>
                        {person.active ? 'فعال' : 'غیرفعال'}
                      </div>
                      {successor && (
                        <div className="mt-0.5 text-[11px] text-[#5B6268]">
                          جایگزین: {successor.fullName}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditing(person)}
                          className="inline-flex items-center gap-1 border border-[#D4CEBF] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#2B3033] hover:border-[#2D5A63] cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>ویرایش</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleActive(person)}
                          className="inline-flex items-center gap-1 border border-[#D4CEBF] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#5B6268] hover:border-[#2D5A63] cursor-pointer"
                        >
                          {person.active ? (
                            <>
                              <UserX className="h-3 w-3" />
                              <span>غیرفعال‌سازی</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3 w-3" />
                              <span>فعال‌سازی</span>
                            </>
                          )}
                        </button>
                        {person.active && (
                          <button
                            type="button"
                            onClick={() => {
                              setReplacing(person);
                              setSuccessorRole(person.roleTitle);
                              setSuccessorDept(person.department);
                            }}
                            className="inline-flex items-center gap-1 border border-[#2D5A63] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
                          >
                            <RefreshCw className="h-3 w-3" />
                            <span>جایگزینی</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {editing !== undefined && (
        <PersonEditorWindow
          initial={editing}
          deviceId={store.settings.deviceId}
          onClose={() => setEditing(undefined)}
          onSave={async (person, isNew) => {
            await store.savePerson(person, isNew);
            setEditing(undefined);
          }}
        />
      )}

      {replacing && (
        <FloatingWindow
          title={`جایگزینی شخص: ${replacing.fullName} (${replacing.roleTitle})`}
          onClose={() => setReplacing(null)}
          width={520}
        >
          <form onSubmit={handleReplaceSubmit} className="space-y-3.5">
            <p className="text-xs leading-6 text-[#5B6268]">
              با ثبت جایگزین، «{replacing.fullName}» غیرفعال شده و سابقه اسناد تاریخی وی کاملاً حفظ می‌شود.
            </p>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">نام شخص جایگزین *</label>
              <input
                type="text"
                required
                value={successorName}
                onChange={(e) => setSuccessorName(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">سمت</label>
              <input
                type="text"
                value={successorRole}
                onChange={(e) => setSuccessorRole(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">واحد سازمانی</label>
              <input
                type="text"
                value={successorDept}
                onChange={(e) => setSuccessorDept(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReplacing(null)}
                className="border border-[#CEC7B6] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs text-[#FAF8F3]"
              >
                ثبت جایگزینی
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}
    </div>
  );
};

const PersonEditorWindow: React.FC<{
  initial: Person | null;
  deviceId: string;
  onSave: (person: Person, isNew: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ initial, deviceId, onSave, onClose }) => {
  const isNew = !initial;
  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [roleTitle, setRoleTitle] = useState(initial?.roleTitle ?? '');
  const [department, setDepartment] = useState(initial?.department ?? 'دفتر فنی اداره گلزار شهدا');
  const [personnelCode, setPersonnelCode] = useState(initial?.personnelCode ?? '');
  const [signatureImageDataUrl, setSignatureImageDataUrl] = useState(
    initial?.signatureImageDataUrl ?? ''
  );

  // Simple flat signature drawing canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#2B3033';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = canvasRef.current.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!drawingRef.current || !canvasRef.current) return;
    drawingRef.current = false;
    setSignatureImageDataUrl(canvasRef.current.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setSignatureImageDataUrl('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setSignatureImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !roleTitle.trim()) return;
    const now = new Date().toISOString();
    await onSave(
      {
        id: initial?.id ?? generateId('per'),
        fullName: fullName.trim(),
        roleTitle: roleTitle.trim(),
        department: department.trim(),
        personnelCode: personnelCode.trim() || undefined,
        active: initial?.active ?? true,
        replacedByPersonId: initial?.replacedByPersonId,
        replacedAt: initial?.replacedAt,
        signatureImageDataUrl: signatureImageDataUrl || undefined,
        isSample: false,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: deviceId,
      },
      isNew
    );
  };

  return (
    <FloatingWindow
      title={isNew ? 'افزودن شخص جدید' : `ویرایش مشخصات: ${initial?.fullName}`}
      onClose={onClose}
      width={560}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">نام و نام خانوادگی *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">سمت *</label>
            <input
              type="text"
              required
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">واحد / معاونت</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">کد پرسنلی (اختیاری)</label>
            <input
              type="text"
              value={personnelCode}
              onChange={(e) => setPersonnelCode(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#2B3033]">
              تصویر امضا (اختیاری — رسم روی صفحه یا بارگذاری تصویر)
            </span>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1 text-xs cursor-pointer hover:bg-[#ECE7DA]">
                <Upload className="h-3 w-3" />
                <span>بارگذاری تصویر</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
              </label>
              <button
                type="button"
                onClick={clearCanvas}
                className="border border-[#CEC7B6] bg-[#FFFFFF] px-2.5 py-1 text-xs text-[#B43E3E] cursor-pointer"
              >
                پاک کردن
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            width={480}
            height={110}
            onPointerDown={startDraw}
            onPointerMove={draw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full touch-none border border-[#CEC7B6] bg-[#FFFFFF] cursor-crosshair"
          />

          {signatureImageDataUrl && (
            <div className="flex items-center gap-2 text-xs text-[#5B6268]">
              <span>پیش‌نمایش ذخیره‌شده:</span>
              <img
                src={signatureImageDataUrl}
                alt="پیش‌نمایش امضا"
                className="h-10 border border-[#E2DDD0] bg-[#FFFFFF] p-0.5 object-contain"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#2D5A63] bg-[#2D5A63] px-5 py-2 text-xs text-[#FAF8F3]"
          >
            {isNew ? 'افزودن شخص' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
