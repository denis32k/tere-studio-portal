import React from 'react';
import { X } from 'lucide-react';
import { qrMake, type PreviewWatermarkAsset } from './canvasHelpers';
import { SIMBOLOS_PRETOS } from './types';

export function IconButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; compact?: boolean }) {
  const { active, compact, className = '', ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl border ${compact ? 'px-2.5 py-2' : 'px-3 py-2.5'} min-h-[44px] [&>svg]:!w-[18px] [&>svg]:!h-[18px] [&>svg]:stroke-[2.3] text-[12px] font-semibold transition ${active ? 'border-[#06111F] bg-[#06111F] text-white shadow-sm' : 'border-border bg-white active:bg-secondary/70 text-foreground'} disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    />
  );
}

export function ToolBlock({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border/80 bg-background/70 p-3 space-y-2 ${className}`}>
      {title && <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">{title}</p>}
      {children}
    </div>
  );
}

export function RangeField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-1">
      <div className="flex justify-between text-[11px] text-muted-foreground"><span>{label}</span><span>{Math.round(value * 100) / 100}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="w-full accent-[#06111F]" />
    </label>
  );
}

export function FormModal({ open, title, description, children, onCancel, onConfirm, confirmLabel = 'Adicionar', confirmDisabled }: { open: boolean; title: string; description?: string; children: React.ReactNode; onCancel: () => void; onConfirm: () => void; confirmLabel?: string; confirmDisabled?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden safe-bottom">
        <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-4">
          <div><h3 className="text-sm font-semibold text-foreground">{title}</h3>{description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}</div>
          <button className="w-8 h-8 rounded-full active:bg-secondary flex items-center justify-center flex-shrink-0" onClick={onCancel}><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">{children}</div>
        <div className="px-5 py-4 border-t border-border flex gap-2">
          <IconButton onClick={onCancel} className="flex-1 justify-center">Cancelar</IconButton>
          <IconButton onClick={onConfirm} active disabled={confirmDisabled} className="flex-1 justify-center">{confirmLabel}</IconButton>
        </div>
      </div>
    </div>
  );
}

export function SymbolsModal({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (s: string) => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-end sm:items-center justify-center">
      <div className="w-full sm:max-w-lg max-h-[75vh] rounded-t-3xl sm:rounded-2xl bg-card border border-border shadow-2xl overflow-hidden flex flex-col safe-bottom">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <div><h3 className="text-sm font-semibold text-foreground">Símbolos</h3><p className="text-xs text-muted-foreground">Escolha um símbolo para colocar no verso.</p></div>
          <button className="w-8 h-8 rounded-full active:bg-secondary flex items-center justify-center" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="p-4 overflow-y-auto">
          <div className="grid grid-cols-6 gap-2">
            {SIMBOLOS_PRETOS.map((s, idx) => (
              <button key={`${s}-${idx}`} type="button" onClick={() => { onPick(s); onClose(); }} className="h-11 rounded-lg border border-border bg-background active:bg-secondary text-xl text-black flex items-center justify-center">{s}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function QRCodePreview({ seed, color = '#111827', pixelSize = 64 }: { seed: string; color?: string; pixelSize?: number }) {
  const value = seed?.trim() || 'https://terepersonalizados.com.br';
  let modules: boolean[][];
  try { modules = qrMake(value); } catch { modules = qrMake('https://terepersonalizados.com.br'); }
  const quiet = 4; const size = modules.length;
  const path = modules.map((row, y) => row.map((cell, x) => cell ? `M${x + quiet},${y + quiet}h1v1h-1z` : '').join('')).join('');
  return <svg width={pixelSize} height={pixelSize} viewBox={`0 0 ${size + quiet * 2} ${size + quiet * 2}`} aria-label="QR Code" shapeRendering="crispEdges" className="block"><path d={path} fill={color} /></svg>;
}

export function ProdutoFallback({ tipo, cor, size = 320 }: { tipo?: string; cor?: string; size?: number }) {
  const stroke = cor === 'dourada' || cor === 'dourado' ? '#C8A96E' : cor === 'preta' || cor === 'preto' ? '#111827' : '#9AA8B4';
  const fill = cor === 'dourada' || cor === 'dourado' ? '#F4E2B5' : cor === 'preta' || cor === 'preto' ? '#222' : '#E5E7EB';
  const isRound = /medalha|redond|circular|colar|pingente/i.test(`${tipo || ''}`);
  return (
    <svg width={size} height={Math.round(size * 1.15)} viewBox="0 0 200 230" className="drop-shadow-sm">
      <rect width="200" height="230" fill="transparent" />
      {isRound ? (
        <>
          <line x1="100" y1="12" x2="100" y2="50" stroke={stroke} strokeWidth="5" />
          <circle cx="100" cy="52" r="9" fill={stroke} />
          <circle cx="100" cy="132" r="72" fill={fill} stroke={stroke} strokeWidth="5" />
        </>
      ) : (
        <>
          <circle cx="100" cy="26" r="17" fill="none" stroke={stroke} strokeWidth="5" />
          <rect x="48" y="52" width="104" height="142" rx="10" fill={fill} stroke={stroke} strokeWidth="5" />
        </>
      )}
    </svg>
  );
}

export function watermarkAssetPadrao(nomeLoja?: string): PreviewWatermarkAsset {
  return { text: String(nomeLoja || 'PRÉVIA').trim() || 'PRÉVIA' };
}
