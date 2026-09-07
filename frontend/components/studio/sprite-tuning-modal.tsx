'use client';
/* eslint-disable @next/next/no-img-element */
import React, { useState, useEffect } from 'react';
import {LoreEditor} from './enchanted-item';
import {PlacementEditor} from './placement-editor';
import type {ItemDetail} from '@/lib/use-item-details';
import type { Item } from '@/lib/types';
import type { SpriteJob } from '@/lib/use-sprites';
import { garmentLabel, slotFor, SLOT_LABEL } from '@/lib/inventory';

export interface SpriteTuningModalProps {
  detail?:ItemDetail;
  detailsLoaded?:boolean;
  onSaveDetail?:(id:string,d:ItemDetail)=>Promise<void>;
  item: Item | null;
  job?: SpriteJob;
  correction: string;
  onClose: () => void;
  onRegenerate: (item: Item, force: boolean, overrides?: Record<string, any>) => Promise<void>;
  onSaveCorrection: (id: string, value: string) => void;
}

const COLOR_PRESETS = [
  { label: 'Mustard Yellow', value: 'mustard-yellow', color: '#c9972c' },
  { label: 'Golden Amber', value: 'amber', color: '#d97d25' },
  { label: 'Olive Green', value: 'olive', color: '#687057' },
  { label: 'Army Green', value: 'army-green', color: '#556044' },
  { label: 'Tan Leather', value: 'tan', color: '#ac8862' },
  { label: 'Navy Blue', value: 'navy', color: '#293c61' },
  { label: 'Charcoal Black', value: 'black', color: '#222226' },
  { label: 'Burgundy', value: 'burgundy', color: '#713848' },
  { label: 'Ivory White', value: 'white', color: '#f0ece1' },
];

export function SpriteTuningModal({
  item,
  detail, detailsLoaded, onSaveDetail,
  job,
  correction,
  onClose,
  onRegenerate,
  onSaveCorrection,
}: SpriteTuningModalProps) {
  const [cutDetails, setCutDetails] = useState(correction || '');
  const [primaryColor, setPrimaryColor] = useState(item?.primary_color || '');
  const [pattern, setPattern] = useState(item?.tags?.pattern || 'solid');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (item) {
      setCutDetails(correction || job?.user_hint?.cut_details || job?.metadata?.cut_details || '');
      setPrimaryColor(job?.user_hint?.primary_color || job?.metadata?.primary_color || item.primary_color || '');
      setPattern(job?.user_hint?.pattern || job?.metadata?.pattern || item.tags?.pattern || 'solid');
    }
  }, [item?.id]);

  if (!item) return null;

  const slot = slotFor(item);
  const isGenerating = busy || (job && !['complete', 'failed'].includes(job.status));

  async function handleRegen() {
    if (!item || isGenerating) return;
    setBusy(true);
    try {
      onSaveCorrection(item.id, cutDetails);
      await onRegenerate(item, true, {
        cut_details: cutDetails,
        primary_color: primaryColor,
        pattern: pattern,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ur-modal-backdrop" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Sprite workshop" className="ur-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ur-modal-header">
          <div>
            <span className="ur-eyebrow">SPRITE WORKSHOP · {SLOT_LABEL[slot].toUpperCase()}</span>
            <h3>{garmentLabel(item)}</h3>
          </div>
          <button type="button" className="ur-modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="ur-modal-body">
          {/* Left Column: Visual Previews */}
          <div className="ur-modal-previews">
            <div className="ur-modal-preview-card">
              <span>Original Photograph</span>
              <img
                src={item.image_url || item.thumbnail_url}
                alt={garmentLabel(item)}
                className="ur-modal-preview-img"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="ur-modal-preview-card">
                <span>Inventory Gump (48×48)</span>
                {job?.status === 'complete' ? (
                  <div style={{ padding: '16px 0' }}>
                    <img
                      src={`/api/inventory/sprites?id=${job.job_id}&kind=inventory&t=${job.updated_at || ''}`}
                      alt="Inventory Sprite"
                      width={96}
                      height={96}
                      className="ur-modal-pixel-img"
                    />
                  </div>
                ) : (
                  <p style={{ color: '#8a8578', fontSize: '11px', padding: '30px 0' }}>
                    {job?.message || 'No sprite yet'}
                  </p>
                )}
              </div>

              <div className="ur-modal-preview-card">
                <span>Paperdoll Layer (220×276)</span>
                {job?.status === 'complete' ? (
                  <div style={{ padding: '6px 0' }}>
                    <img
                      src={`/api/inventory/sprites?id=${job.job_id}&kind=paperdoll&t=${job.updated_at || ''}`}
                      alt="Paperdoll Layer"
                      width={90}
                      height={113}
                      className="ur-modal-pixel-img"
                    />
                  </div>
                ) : (
                  <p style={{ color: '#8a8578', fontSize: '11px', padding: '30px 0' }}>
                    {job?.message || 'No layer yet'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Tuning Controls */}
          <div className="ur-modal-controls">
            {detailsLoaded&&onSaveDetail&&<PlacementEditor key={item.id} item={item} jobId={job?.status==='complete'?job.job_id:undefined} detail={detail} onSave={onSaveDetail}/>}
            {detailsLoaded&&onSaveDetail&&<LoreEditor key={item.id} item={item} detail={detail} onSave={onSaveDetail}/>}
            <label>
              Primary Color Prompt / Hue
              <input
                type="text"
                value={primaryColor}
                placeholder="e.g. mustard-yellow, olive-green, tan"
                onChange={(e) => setPrimaryColor(e.target.value)}
              />
            </label>

            <div>
              <span style={{ fontSize: '10px', color: '#b5a77f', textTransform: 'uppercase' }}>
                Quick Color Palettes
              </span>
              <div className="ur-modal-presets">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    className="ur-modal-preset-btn"
                    onClick={() => setPrimaryColor(preset.value)}
                  >
                    <span
                      style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        background: preset.color,
                        marginRight: '5px',
                        border: '1px solid #0004',
                      }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <label>
              Pattern &amp; Surface Texture
              <select value={pattern} onChange={(e) => setPattern(e.target.value)}>
                <option value="solid">Solid Fabric (Clean Flat Retro VGA)</option>
                <option value="denim">Denim Weave (Subtle Cross-Dither)</option>
                <option value="knit">Knit / Wool (Heathered Texture)</option>
                <option value="plaid">Plaid / Check</option>
                <option value="stripes">Striped</option>
              </select>
            </label>

            <label>
              Cut &amp; Silhouette Styling Notes
              <textarea
                value={cutDetails}
                placeholder="e.g. contrasting collar, patch pockets, hip-length hem, oversized fit"
                onChange={(e) => setCutDetails(e.target.value)}
              />
            </label>

            <div style={{ marginTop: 'auto', paddingTop: '10px' }}>
              <p style={{ fontSize: '11px', color: '#a89f89', lineHeight: '1.5' }}>
                Regenerating processes the photo locally on <em>your server</em> and rebuilds the inventory icon and worn layer. Cut corrections control the silhouette; photographic patterns remain approximate.
              </p>
            </div>
          </div>
        </div>

        <footer className="ur-modal-footer">
          <span className="ur-modal-status">
            {isGenerating ? '✦ Engine synthesizing new sprites…' : job?.message || 'Ready'}
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="button" onClick={onClose} style={{ background: 'none', border: '1px solid #66543b', color: '#e6d7af', padding: '10px 16px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button
              type="button"
              className="ur-modal-regen-btn"
              disabled={isGenerating}
              onClick={handleRegen}
            >
              {isGenerating ? 'Synthesizing…' : '✦ Regenerate Sprite'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
