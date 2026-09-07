'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SpritefyClient, type SpritefyJobResponse } from '@/lib/spritefy-client';

export interface EquippedGarment {
  id: string;
  type: string;
  name?: string;
  primary_color?: string;
  job_id?: string;
}

export type AvatarPreset = 'custom' | 'living_room' | 'heroic' | 'mannequin';

export interface UltimaPaperDollProps {
  items?: EquippedGarment[];
  preset?: AvatarPreset;
  tucked?: boolean;
  withCard?: boolean;
  scale?: number;
  avatarType?: 'user' | 'classic';
  clientUrl?: string;
  onRegenerate?: (item: EquippedGarment) => void;
  className?: string;
}

export function UltimaPaperDoll({
  items = [],
  preset = 'custom',
  tucked = false,
  withCard = true,
  scale = 2,
  avatarType = 'user',
  clientUrl,
  onRegenerate,
  className = '',
}: UltimaPaperDollProps) {
  const client = useMemo(() => new SpritefyClient(clientUrl), [clientUrl]);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Equipped job IDs from items that have been sprite-ified
  const jobIds = useMemo(
    () => items.map(i => i.job_id).filter((id): id is string => !!id),
    [items]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPaperdoll() {
      setLoading(true);
      setError(null);
      try {
        if (preset === 'living_room') {
          setImageUrl(client.getUserModernAvatarUrl(scale));
          return;
        }
        if (preset === 'heroic') {
          setImageUrl(client.getUserHeroicAvatarUrl(scale));
          return;
        }
        if (preset === 'mannequin' || jobIds.length === 0) {
          // Render base avatar
          const baseBlob = await client.compositePaperdoll({
            equipped_job_ids: [],
            tucked,
            with_card: withCard,
            scale,
            avatar_type: avatarType,
          });
          if (!cancelled) {
            setImageUrl(URL.createObjectURL(baseBlob));
          }
          return;
        }

        // Render composited paperdoll with equipped layers
        const blob = await client.compositePaperdoll({
          equipped_job_ids: jobIds,
          tucked,
          with_card: withCard,
          scale,
          avatar_type: avatarType,
        });
        if (!cancelled) {
          setImageUrl(URL.createObjectURL(blob));
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Could not load character sheet');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadPaperdoll();

    return () => {
      cancelled = true;
    };
  }, [client, jobIds, preset, tucked, withCard, scale, avatarType]);

  const width = 220 * scale;
  const height = 276 * scale;

  return (
    <div
      className={`ultima-paperdoll-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        background: withCard ? 'transparent' : '#110e0b',
        border: withCard ? 'none' : '2px solid #8c7324',
        boxShadow: '0 8px 24px rgba(0,0,0,0.8)',
      }}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt="Avatar Character Sheet"
          width={width}
          height={height}
          style={{
            imageRendering: 'pixelated',
            display: 'block',
          }}
        />
      )}

      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffdf78',
            fontFamily: 'Georgia, serif',
            fontSize: '0.9rem',
          }}
        >
          <span>Equipping Avatar…</span>
        </div>
      )}

      {error && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            left: 8,
            right: 8,
            background: 'rgba(120, 20, 20, 0.9)',
            color: '#fff',
            padding: '4px 8px',
            fontSize: '0.75rem',
            borderRadius: 4,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
