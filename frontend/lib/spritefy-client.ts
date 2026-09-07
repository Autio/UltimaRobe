/**
 * Spritefy Client SDK for Wardrowbe / WardAvatar
 * Strongly-typed TypeScript client for connecting Wardrowbe to the local Spritefy engine.
 */

export interface SpritefyJobResponse {
  job_id: string;
  item_id: string;
  owner: string;
  status: 'queued' | 'segmenting' | 'analyzing' | 'synthesizing' | 'complete' | 'failed';
  progress: number;
  message: string;
  created_at: number;
  updated_at: number;
  metadata?: {
    slot: string;
    garment_type: string;
    primary_color: string;
    dominant_rgb: [number, number, number];
    palette_index: number;
    pattern: string;
    material: string;
    slot_bounds?: [number, number, number, number];
  };
  urls?: {
    inventory_sprite: string;
    paperdoll_sprite: string;
  };
  error?: string;
}

export interface SpritefyCompositeOptions {
  equipped_job_ids: string[];
  tucked?: boolean;
  with_card?: boolean;
  scale?: number;
  avatar_type?: 'user' | 'classic';
}

export class SpritefyClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_SPRITEFY_URL || 'http://localhost:8190') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Check if Spritefy engine is reachable and inspect GPU status.
   */
  async health(): Promise<{ status: string; gpu?: { cuda_available: boolean; device?: string; free_gb?: number } }> {
    const res = await fetch(`${this.baseUrl}/health`);
    if (!res.ok) throw new Error(`Spritefy health check failed: ${res.statusText}`);
    return res.json();
  }

  /**
   * Submit an image file (Blob/File) for queued sprite-ification.
   */
  async enqueueGarment(
    file: Blob | File,
    itemId: string,
    owner: string = 'default',
    hint?: { slot?: string; pattern?: string; material?: string }
  ): Promise<{ job_id: string; status: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('item_id', itemId);
    formData.append('owner', owner);
    if (hint) {
      formData.append('user_hint', JSON.stringify(hint));
    }

    const res = await fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`Failed to enqueue garment: ${res.statusText}`);
    return res.json();
  }

  /**
   * Poll status of an active sprite generation job.
   */
  async getJobStatus(jobId: string): Promise<SpritefyJobResponse> {
    const res = await fetch(`${this.baseUrl}/api/v1/jobs/${jobId}`);
    if (!res.ok) throw new Error(`Job ${jobId} not found: ${res.statusText}`);
    return res.json();
  }

  /**
   * Trigger manual regeneration of an item's sprites with optional updated parameters.
   */
  async regenerateItem(
    itemId: string,
    owner: string = 'default',
    hint?: { slot?: string; pattern?: string }
  ): Promise<{ job_id: string; message: string }> {
    const res = await fetch(`${this.baseUrl}/api/v1/items/${encodeURIComponent(itemId)}/regenerate?owner=${encodeURIComponent(owner)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: hint ? JSON.stringify(hint) : undefined,
    });

    if (!res.ok) throw new Error(`Failed to regenerate item ${itemId}: ${res.statusText}`);
    return res.json();
  }

  /**
   * Composite equipped clothing layers onto the Avatar paperdoll and return Blob URL.
   */
  async compositePaperdoll(options: SpritefyCompositeOptions): Promise<Blob> {
    const res = await fetch(`${this.baseUrl}/api/v1/paperdoll/composite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        equipped_job_ids: options.equipped_job_ids,
        tucked: options.tucked ?? false,
        with_card: options.with_card ?? true,
        scale: options.scale ?? 2,
        avatar_type: options.avatar_type ?? 'user',
      }),
    });

    if (!res.ok) throw new Error(`Paperdoll composite failed: ${res.statusText}`);
    return res.blob();
  }

  /**
   * Get direct URL to an item's 48x48 / 64x64 inventory sprite.
   */
  getInventorySpriteUrl(jobId: string): string {
    return `${this.baseUrl}/api/v1/jobs/${jobId}/inventory`;
  }

  /**
   * Get direct URL to an item's 220x276 snapped paperdoll layer sprite.
   */
  getPaperdollSpriteUrl(jobId: string): string {
    return `${this.baseUrl}/api/v1/jobs/${jobId}/paperdoll`;
  }

  /**
   * Get direct URL to user modern living room avatar (Space Dandy tee + striped boxers).
   */
  getUserModernAvatarUrl(scale: number = 2): string {
    return `${this.baseUrl}/api/v1/avatar/user/modern?scale=${scale}`;
  }

  /**
   * Get direct URL to user heroic avatar (classic Ultima VII armor & crimson cape).
   */
  getUserHeroicAvatarUrl(scale: number = 2): string {
    return `${this.baseUrl}/api/v1/avatar/user/heroic?scale=${scale}`;
  }

  /**
   * Get direct URL to base avatar mannequin.
   */
  getBaseAvatarUrl(scale: number = 2, withCard: boolean = true, avatarType: string = 'user'): string {
    return `${this.baseUrl}/api/v1/avatar/base?scale=${scale}&with_card=${withCard}&avatar_type=${avatarType}`;
  }
}
