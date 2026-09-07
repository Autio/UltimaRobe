"""Job Queue & Asynchronous State Manager for Spritefy.

Handles persistent task queueing, concurrency control, progress reporting,
and manual regeneration for uploaded clothing items.
"""
import os
import sys
import time
import json
import uuid
import sqlite3
import threading
from pathlib import Path
from typing import Dict, Any, Optional, List
from concurrent.futures import ThreadPoolExecutor
from PIL import Image

from spritefy.generator import SpriteGenerator

DEFAULT_DATA_DIR = Path(os.environ.get('SPRITEFY_DATA', Path(__file__).parent.parent / 'data'))
DEFAULT_DATA_DIR.mkdir(parents=True, exist_ok=True)

class JobQueue:
    """Persistent SQLite job queue with background worker."""

    def __init__(self, data_dir: Path = DEFAULT_DATA_DIR, max_workers: int = 1, use_ollama: bool = True):
        self.data_dir = data_dir
        self.images_dir = self.data_dir / 'images'
        self.sprites_dir = self.data_dir / 'sprites'
        self.images_dir.mkdir(parents=True, exist_ok=True)
        self.sprites_dir.mkdir(parents=True, exist_ok=True)
        
        self.db_path = self.data_dir / 'queue.db'
        self._init_db()
        with self._get_conn() as conn:
            conn.execute("UPDATE jobs SET status='failed', message='Service restarted; regenerate this sprite' WHERE status NOT IN ('complete','failed')")
        
        self.pool = ThreadPoolExecutor(max_workers=max_workers)
        self.generator = SpriteGenerator(use_ollama=use_ollama)
        self.lock = threading.Lock()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._get_conn() as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    item_id TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress INTEGER NOT NULL DEFAULT 0,
                    message TEXT,
                    input_image TEXT NOT NULL,
                    user_hint TEXT,
                    inventory_sprite TEXT,
                    paperdoll_sprite TEXT,
                    metadata TEXT,
                    error TEXT,
                    created_at REAL NOT NULL,
                    updated_at REAL NOT NULL
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_item_owner ON jobs (item_id, owner)')
            conn.commit()

    def enqueue(
        self,
        item_id: str,
        image: Image.Image,
        owner: str = 'default',
        user_hint: Optional[Dict[str, Any]] = None
    ) -> str:
        """Enqueue a clothing item for sprite generation."""
        job_id = uuid.uuid4().hex
        now = time.time()
        
        # Save input image
        input_filename = f"{job_id}_input.png"
        input_path = self.images_dir / input_filename
        image.save(input_path, format='PNG')
        
        hint_json = json.dumps(user_hint or {})
        
        with self._get_conn() as conn:
            conn.execute('''
                INSERT INTO jobs (
                    job_id, item_id, owner, status, progress, message,
                    input_image, user_hint, created_at, updated_at
                ) VALUES (?, ?, ?, 'queued', 0, 'Waiting in queue', ?, ?, ?, ?)
            ''', (job_id, item_id, owner, str(input_path), hint_json, now, now))
            conn.commit()
            
        self.pool.submit(self._worker, job_id)
        return job_id

    def regenerate(
        self,
        item_id: str,
        owner: str = 'default',
        updated_hint: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Manually trigger re-generation of an item's sprites with updated parameters.
        Re-uses the existing source image.
        """
        job = self.get_by_item(item_id, owner)
        if not job:
            return None
            
        input_path = Path(job['input_image'])
        if not input_path.exists():
            return None
            
        img = Image.open(input_path)
        # Merge previous hint with updated hint
        raw_hint = job.get('user_hint')
        if isinstance(raw_hint, dict):
            existing_hint = raw_hint.copy()
        elif isinstance(raw_hint, str):
            try: existing_hint = json.loads(raw_hint)
            except: existing_hint = {}
        else:
            existing_hint = {}
            
        if updated_hint:
            existing_hint.update(updated_hint)
            
        return self.enqueue(item_id, img, owner=owner, user_hint=existing_hint)

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve job status and result by job ID."""
        with self._get_conn() as conn:
            row = conn.execute('SELECT * FROM jobs WHERE job_id = ?', (job_id,)).fetchone()
            if row:
                d = dict(row)
                if d.get('metadata'):
                    try: d['metadata'] = json.loads(d['metadata'])
                    except: pass
                if d.get('user_hint'):
                    try: d['user_hint'] = json.loads(d['user_hint'])
                    except: pass
                return d
        return None

    def get_by_item(self, item_id: str, owner: str = 'default') -> Optional[Dict[str, Any]]:
        """Retrieve latest job for a specific wardrobe item."""
        with self._get_conn() as conn:
            row = conn.execute(
                'SELECT * FROM jobs WHERE item_id = ? AND owner = ? ORDER BY created_at DESC LIMIT 1',
                (item_id, owner)
            ).fetchone()
            if row:
                d = dict(row)
                if d.get('metadata'):
                    try: d['metadata'] = json.loads(d['metadata'])
                    except: pass
                if d.get('user_hint'):
                    try: d['user_hint'] = json.loads(d['user_hint'])
                    except: pass
                return d
        return None

    def list_jobs(self, owner: Optional[str] = None, limit: int = 50) -> List[Dict[str, Any]]:
        """List recent jobs."""
        with self._get_conn() as conn:
            if owner:
                rows = conn.execute(
                    'SELECT * FROM jobs WHERE owner = ? ORDER BY created_at DESC LIMIT ?',
                    (owner, limit)
                ).fetchall()
            else:
                rows = conn.execute(
                    'SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?',
                    (limit,)
                ).fetchall()
            results = []
            for r in rows:
                d = dict(r)
                if d.get('metadata'):
                    try: d['metadata'] = json.loads(d['metadata'])
                    except: pass
                results.append(d)
            return results

    def _update_status(self, job_id: str, status: str, progress: int, message: str, **kwargs):
        now = time.time()
        with self._get_conn() as conn:
            fields = ['status = ?', 'progress = ?', 'message = ?', 'updated_at = ?']
            params = [status, progress, message, now]
            for k, v in kwargs.items():
                fields.append(f"{k} = ?")
                params.append(v)
            params.append(job_id)
            conn.execute(f"UPDATE jobs SET {', '.join(fields)} WHERE job_id = ?", params)
            conn.commit()

    def _worker(self, job_id: str):
        """Worker thread processing a single sprite generation task."""
        try:
            job = self.get_job(job_id)
            if not job:
                return
                
            input_path = Path(job['input_image'])
            user_hint = job.get('user_hint') or {}
            
            self._update_status(job_id, 'segmenting', 20, 'Removing background and isolating garment')
            img = Image.open(input_path)
            
            self._update_status(job_id, 'analyzing', 45, 'Analyzing garment type, cut, and palette colors')
            
            self._update_status(job_id, 'synthesizing', 70, 'Forging Ultima VII inventory sprite and paperdoll layer')
            result = self.generator.process(img, user_hint=user_hint)
            
            # Save sprites
            inv_filename = f"{job_id}_inventory.png"
            inv_path = self.sprites_dir / inv_filename
            result['inventory_sprite'].save(inv_path, format='PNG')
            
            doll_filename = f"{job_id}_paperdoll.png"
            doll_path = self.sprites_dir / doll_filename
            result['paperdoll_sprite'].save(doll_path, format='PNG')
            
            meta_json = json.dumps({
                'version': result.get('version'),
                'cut_details': result.get('cut_details'),
                'fit': result.get('fit'),
                'features': result.get('features'),
                'slot': result['slot'],
                'garment_type': result['garment_type'],
                'primary_color': result['primary_color'],
                'dominant_rgb': result['dominant_rgb'],
                'palette_index': result['palette_index'],
                'pattern': result['pattern'],
                'material': result['material'],
                'slot_bounds': result['slot_bounds']
            })
            
            self._update_status(
                job_id,
                'complete',
                100,
                'Sprites ready',
                inventory_sprite=str(inv_path),
                paperdoll_sprite=str(doll_path),
                metadata=meta_json
            )
            
        except (Exception, SystemExit) as exc:
            import traceback
            tb = traceback.format_exc()
            self._update_status(job_id, 'failed', 0, 'Generation failed', error=f"{type(exc).__name__}: {exc}\n{tb}")
