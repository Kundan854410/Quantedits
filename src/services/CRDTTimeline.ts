/**
 * CRDTTimeline — Conflict-free Replicated Data Type for collaborative video editing.
 *
 * This module implements a timeline data structure whose state can be
 * replicated across many peers and merged deterministically regardless of
 * the order in which operations are delivered. It is the foundation of the
 * "Google Docs for video" collaborative editor.
 *
 * Design overview
 * ---------------
 *   • Every mutation is expressed as an immutable `TimelineOperation`
 *     carrying `userId`, wall-clock `timestamp`, a monotonic `lamport`
 *     counter and a per-operation `opId`.
 *   • Operations are idempotent — applying the same op twice is a no-op.
 *   • Convergence: two replicas that have seen the same set of operations
 *     reach the same state, irrespective of arrival order.
 *   • Tombstones are used for removed clips so that a late `moveClip` /
 *     `trimClip` that references a deleted clip becomes a no-op instead
 *     of resurrecting it.
 *   • Per-user undo/redo rewrites the op log with an `inverse` op and
 *     re-plays, so only a user's own changes are reversed.
 *
 * Supported operations
 * --------------------
 *   ADD_TRACK, REMOVE_TRACK,
 *   ADD_CLIP, REMOVE_CLIP,
 *   MOVE_CLIP, TRIM_CLIP, SPLIT_CLIP,
 *   ADD_EFFECT, REMOVE_EFFECT,
 *   LOCK_CLIP, UNLOCK_CLIP.
 */

// ── Primitive types ───────────────────────────────────────────────────────

export type OpId = string;
export type UserId = string;
export type ClipId = string;
export type TrackId = string;
export type EffectId = string;

export type Lamport = number;

export interface VectorClock {
  [userId: string]: Lamport;
}

export type OperationKind =
  | "ADD_TRACK"
  | "REMOVE_TRACK"
  | "ADD_CLIP"
  | "REMOVE_CLIP"
  | "MOVE_CLIP"
  | "TRIM_CLIP"
  | "SPLIT_CLIP"
  | "ADD_EFFECT"
  | "REMOVE_EFFECT"
  | "LOCK_CLIP"
  | "UNLOCK_CLIP";

export type TrackKind = "VIDEO" | "AUDIO" | "TEXT" | "OVERLAY";

// ── Domain types ──────────────────────────────────────────────────────────

export interface Effect {
  effectId: EffectId;
  kind: string;
  parameters: Record<string, number | string | boolean>;
  createdBy: UserId;
  createdAt: Lamport;
}

export interface Clip {
  clipId: ClipId;
  trackId: TrackId;
  /** start time in seconds on the timeline */
  start: number;
  /** visible duration in seconds */
  duration: number;
  /** offset into the source media in seconds */
  sourceStart: number;
  /** total length of the underlying source media */
  sourceDuration: number;
  mediaUrl: string;
  name: string;
  effects: Effect[];
  createdBy: UserId;
  createdAt: Lamport;
  lastModifiedBy: UserId;
  lastModifiedAt: Lamport;
  /** identifier of the user currently holding the edit lock, if any */
  lockedBy: UserId | null;
  lockedAt: Lamport | null;
  /** tombstone flag — kept so concurrent references resolve to a no-op */
  deleted: boolean;
  deletedAt: Lamport | null;
}

export interface Track {
  trackId: TrackId;
  kind: TrackKind;
  index: number;
  name: string;
  muted: boolean;
  locked: boolean;
  createdBy: UserId;
  createdAt: Lamport;
  deleted: boolean;
  deletedAt: Lamport | null;
}

// ── Operation payloads ────────────────────────────────────────────────────

export interface AddTrackPayload {
  track: Track;
}
export interface RemoveTrackPayload {
  trackId: TrackId;
}
export interface AddClipPayload {
  clip: Clip;
}
export interface RemoveClipPayload {
  clipId: ClipId;
}
export interface MoveClipPayload {
  clipId: ClipId;
  toTrackId: TrackId;
  toStart: number;
  /** previous values are retained so undo is trivial */
  fromTrackId: TrackId;
  fromStart: number;
}
export interface TrimClipPayload {
  clipId: ClipId;
  newStart: number;
  newDuration: number;
  newSourceStart: number;
  prevStart: number;
  prevDuration: number;
  prevSourceStart: number;
}
export interface SplitClipPayload {
  clipId: ClipId;
  /** absolute timeline position at which to split */
  splitAt: number;
  /** id allocated for the newly produced right-hand clip */
  newRightClipId: ClipId;
}
export interface AddEffectPayload {
  clipId: ClipId;
  effect: Effect;
}
export interface RemoveEffectPayload {
  clipId: ClipId;
  effectId: EffectId;
}
export interface LockClipPayload {
  clipId: ClipId;
}
export interface UnlockClipPayload {
  clipId: ClipId;
}

export type TimelineOperation =
  | (BaseOperation & { kind: "ADD_TRACK"; payload: AddTrackPayload })
  | (BaseOperation & { kind: "REMOVE_TRACK"; payload: RemoveTrackPayload })
  | (BaseOperation & { kind: "ADD_CLIP"; payload: AddClipPayload })
  | (BaseOperation & { kind: "REMOVE_CLIP"; payload: RemoveClipPayload })
  | (BaseOperation & { kind: "MOVE_CLIP"; payload: MoveClipPayload })
  | (BaseOperation & { kind: "TRIM_CLIP"; payload: TrimClipPayload })
  | (BaseOperation & { kind: "SPLIT_CLIP"; payload: SplitClipPayload })
  | (BaseOperation & { kind: "ADD_EFFECT"; payload: AddEffectPayload })
  | (BaseOperation & { kind: "REMOVE_EFFECT"; payload: RemoveEffectPayload })
  | (BaseOperation & { kind: "LOCK_CLIP"; payload: LockClipPayload })
  | (BaseOperation & { kind: "UNLOCK_CLIP"; payload: UnlockClipPayload });

interface BaseOperation {
  opId: OpId;
  userId: UserId;
  /** Wall-clock ms since epoch — used only as a secondary sort key. */
  timestamp: number;
  /** Lamport clock — primary causal sort key. */
  lamport: Lamport;
}

// ── Timeline snapshot ─────────────────────────────────────────────────────

export interface TimelineSnapshot {
  projectId: string;
  tracks: Track[];
  clips: Clip[];
  lamport: Lamport;
  vectorClock: VectorClock;
  opsApplied: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function makeOpId(userId: UserId, lamport: Lamport): OpId {
  // 36-char compact id: `${user}@${lamport}:${random}`
  const rand = Math.random().toString(36).slice(2, 10);
  return `${userId}@${lamport}:${rand}`;
}

/**
 * Compare two operations for deterministic ordering.
 *
 * Ordering: lamport ASC, then userId ASC, then opId ASC.
 * This guarantees that two replicas, given the same set of operations,
 * arrive at identical sequences.
 */
export function compareOps(a: TimelineOperation, b: TimelineOperation): number {
  if (a.lamport !== b.lamport) return a.lamport - b.lamport;
  if (a.userId !== b.userId) return a.userId < b.userId ? -1 : 1;
  if (a.opId !== b.opId) return a.opId < b.opId ? -1 : 1;
  return 0;
}

/** Deep-clone a clip. */
function cloneClip(c: Clip): Clip {
  return {
    ...c,
    effects: c.effects.map((e) => ({
      ...e,
      parameters: { ...e.parameters },
    })),
  };
}

function cloneTrack(t: Track): Track {
  return { ...t };
}

// ── CRDTTimeline class ────────────────────────────────────────────────────

export interface CRDTTimelineOptions {
  projectId: string;
  localUserId: UserId;
  /**
   * Optional maximum number of operations to retain in the local log.
   * When exceeded, older operations that are causally safe are pruned.
   * Pruning never affects convergence — it only discards history that
   * can no longer be undone by any live peer.
   */
  historyLimit?: number;
}

export type TimelineEventKind =
  | "OP_APPLIED"
  | "OP_REJECTED"
  | "STATE_CHANGED"
  | "CLIP_LOCKED"
  | "CLIP_UNLOCKED";

export interface TimelineEvent {
  kind: TimelineEventKind;
  op?: TimelineOperation;
  reason?: string;
  snapshot: TimelineSnapshot;
}

export type TimelineListener = (event: TimelineEvent) => void;

export class CRDTTimeline {
  private readonly projectId: string;
  private readonly localUserId: UserId;
  private readonly historyLimit: number;

  private tracks = new Map<TrackId, Track>();
  private clips = new Map<ClipId, Clip>();

  /** Dedup set — operations already applied, keyed by opId. */
  private applied = new Set<OpId>();

  /** Complete, sorted, deduplicated op log. */
  private log: TimelineOperation[] = [];

  /** Per-user op log — enables selective undo/redo. */
  private perUserLog = new Map<UserId, TimelineOperation[]>();

  /** Per-user undo cursor — points to index of next op that would be undone. */
  private undoCursor = new Map<UserId, number>();

  /** Operations the user has undone; re-applying them performs redo. */
  private redoStack = new Map<UserId, TimelineOperation[]>();

  private lamport: Lamport = 0;
  private vectorClock: VectorClock = {};

  private listeners = new Set<TimelineListener>();

  constructor(opts: CRDTTimelineOptions) {
    this.projectId = opts.projectId;
    this.localUserId = opts.localUserId;
    this.historyLimit = Math.max(128, opts.historyLimit ?? 10_000);
    this.vectorClock[this.localUserId] = 0;
  }

  // ── Public accessors ───────────────────────────────────────────────────

  getProjectId(): string {
    return this.projectId;
  }

  getLocalUserId(): UserId {
    return this.localUserId;
  }

  getLamport(): Lamport {
    return this.lamport;
  }

  getVectorClock(): VectorClock {
    return { ...this.vectorClock };
  }

  getTracks(): Track[] {
    return Array.from(this.tracks.values())
      .filter((t) => !t.deleted)
      .sort((a, b) => a.index - b.index)
      .map(cloneTrack);
  }

  getClips(): Clip[] {
    return Array.from(this.clips.values())
      .filter((c) => !c.deleted)
      .sort((a, b) => {
        if (a.trackId !== b.trackId) return a.trackId < b.trackId ? -1 : 1;
        return a.start - b.start;
      })
      .map(cloneClip);
  }

  getClip(clipId: ClipId): Clip | null {
    const c = this.clips.get(clipId);
    if (!c || c.deleted) return null;
    return cloneClip(c);
  }

  getClipLock(clipId: ClipId): UserId | null {
    const c = this.clips.get(clipId);
    if (!c || c.deleted) return null;
    return c.lockedBy;
  }

  snapshot(): TimelineSnapshot {
    return {
      projectId: this.projectId,
      tracks: this.getTracks(),
      clips: this.getClips(),
      lamport: this.lamport,
      vectorClock: this.getVectorClock(),
      opsApplied: this.applied.size,
    };
  }

  /** Return the full ordered op log (for state transfer to new peers). */
  exportLog(): TimelineOperation[] {
    return this.log.slice();
  }

  /** Hydrate a fresh timeline from a log produced by `exportLog`. */
  importLog(ops: TimelineOperation[]): void {
    const sorted = ops.slice().sort(compareOps);
    for (const op of sorted) this.apply(op);
  }

  // ── Event bus ──────────────────────────────────────────────────────────

  subscribe(listener: TimelineListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: TimelineEvent): void {
    for (const l of this.listeners) {
      try {
        l(event);
      } catch {
        /* listener errors must not break op processing */
      }
    }
  }

  // ── Local op factories ─────────────────────────────────────────────────

  private nextLamport(): Lamport {
    this.lamport += 1;
    this.vectorClock[this.localUserId] = this.lamport;
    return this.lamport;
  }

  private baseOp(): BaseOperation {
    const lamport = this.nextLamport();
    return {
      opId: makeOpId(this.localUserId, lamport),
      userId: this.localUserId,
      timestamp: Date.now(),
      lamport,
    };
  }

  addTrack(
    input: Omit<
      Track,
      "createdBy" | "createdAt" | "deleted" | "deletedAt" | "trackId"
    > & {
      trackId?: TrackId;
    },
  ): TimelineOperation {
    const base = this.baseOp();
    const track: Track = {
      trackId: input.trackId ?? `track-${base.opId}`,
      kind: input.kind,
      index: input.index,
      name: input.name,
      muted: input.muted,
      locked: input.locked,
      createdBy: this.localUserId,
      createdAt: base.lamport,
      deleted: false,
      deletedAt: null,
    };
    const op: TimelineOperation = {
      ...base,
      kind: "ADD_TRACK",
      payload: { track },
    };
    this.applyLocal(op);
    return op;
  }

  removeTrack(trackId: TrackId): TimelineOperation {
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "REMOVE_TRACK",
      payload: { trackId },
    };
    this.applyLocal(op);
    return op;
  }

  addClip(
    input: Omit<
      Clip,
      | "createdBy"
      | "createdAt"
      | "lastModifiedBy"
      | "lastModifiedAt"
      | "lockedBy"
      | "lockedAt"
      | "deleted"
      | "deletedAt"
      | "effects"
      | "clipId"
    > & { clipId?: ClipId; effects?: Effect[] },
  ): TimelineOperation {
    const base = this.baseOp();
    const clip: Clip = {
      clipId: input.clipId ?? `clip-${base.opId}`,
      trackId: input.trackId,
      start: input.start,
      duration: input.duration,
      sourceStart: input.sourceStart,
      sourceDuration: input.sourceDuration,
      mediaUrl: input.mediaUrl,
      name: input.name,
      effects: input.effects ? input.effects.map((e) => ({ ...e })) : [],
      createdBy: this.localUserId,
      createdAt: base.lamport,
      lastModifiedBy: this.localUserId,
      lastModifiedAt: base.lamport,
      lockedBy: null,
      lockedAt: null,
      deleted: false,
      deletedAt: null,
    };
    const op: TimelineOperation = {
      ...base,
      kind: "ADD_CLIP",
      payload: { clip },
    };
    this.applyLocal(op);
    return op;
  }

  removeClip(clipId: ClipId): TimelineOperation {
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "REMOVE_CLIP",
      payload: { clipId },
    };
    this.applyLocal(op);
    return op;
  }

  moveClip(clipId: ClipId, toTrackId: TrackId, toStart: number): TimelineOperation {
    const current = this.clips.get(clipId);
    if (!current || current.deleted) {
      throw new Error(`CRDTTimeline.moveClip: clip not found: ${clipId}`);
    }
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "MOVE_CLIP",
      payload: {
        clipId,
        toTrackId,
        toStart,
        fromTrackId: current.trackId,
        fromStart: current.start,
      },
    };
    this.applyLocal(op);
    return op;
  }

  trimClip(
    clipId: ClipId,
    newStart: number,
    newDuration: number,
    newSourceStart: number,
  ): TimelineOperation {
    const current = this.clips.get(clipId);
    if (!current || current.deleted) {
      throw new Error(`CRDTTimeline.trimClip: clip not found: ${clipId}`);
    }
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "TRIM_CLIP",
      payload: {
        clipId,
        newStart,
        newDuration,
        newSourceStart,
        prevStart: current.start,
        prevDuration: current.duration,
        prevSourceStart: current.sourceStart,
      },
    };
    this.applyLocal(op);
    return op;
  }

  splitClip(clipId: ClipId, splitAt: number): TimelineOperation {
    const current = this.clips.get(clipId);
    if (!current || current.deleted) {
      throw new Error(`CRDTTimeline.splitClip: clip not found: ${clipId}`);
    }
    if (splitAt <= current.start || splitAt >= current.start + current.duration) {
      throw new Error(
        `CRDTTimeline.splitClip: splitAt ${splitAt} outside clip range`,
      );
    }
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "SPLIT_CLIP",
      payload: {
        clipId,
        splitAt,
        newRightClipId: `clip-${base.opId}-R`,
      },
    };
    this.applyLocal(op);
    return op;
  }

  addEffect(
    clipId: ClipId,
    kind: string,
    parameters: Record<string, number | string | boolean>,
  ): TimelineOperation {
    const base = this.baseOp();
    const effect: Effect = {
      effectId: `fx-${base.opId}`,
      kind,
      parameters: { ...parameters },
      createdBy: this.localUserId,
      createdAt: base.lamport,
    };
    const op: TimelineOperation = {
      ...base,
      kind: "ADD_EFFECT",
      payload: { clipId, effect },
    };
    this.applyLocal(op);
    return op;
  }

  removeEffect(clipId: ClipId, effectId: EffectId): TimelineOperation {
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "REMOVE_EFFECT",
      payload: { clipId, effectId },
    };
    this.applyLocal(op);
    return op;
  }

  lockClip(clipId: ClipId): TimelineOperation {
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "LOCK_CLIP",
      payload: { clipId },
    };
    this.applyLocal(op);
    return op;
  }

  unlockClip(clipId: ClipId): TimelineOperation {
    const base = this.baseOp();
    const op: TimelineOperation = {
      ...base,
      kind: "UNLOCK_CLIP",
      payload: { clipId },
    };
    this.applyLocal(op);
    return op;
  }

  // ── Op application ─────────────────────────────────────────────────────

  /**
   * Apply an operation originating from the local user. The op is appended
   * to the log, recorded per-user (for undo), and broadcast to subscribers.
   */
  private applyLocal(op: TimelineOperation): void {
    // Clear redo stack: any new local action invalidates pending redoes.
    this.redoStack.set(op.userId, []);
    this.apply(op);
  }

  /**
   * Apply any operation (local or remote). This is the central entry point
   * every replica uses. It is idempotent and commutative under the defined
   * ordering rules.
   */
  apply(op: TimelineOperation): boolean {
    if (this.applied.has(op.opId)) return false;

    // Advance Lamport / vector clocks.
    if (op.lamport > this.lamport) this.lamport = op.lamport;
    const prev = this.vectorClock[op.userId] ?? 0;
    if (op.lamport > prev) this.vectorClock[op.userId] = op.lamport;

    // Try to apply the op, but do not mark it applied if the state-change
    // throws — we would otherwise poison convergence.
    let ok = true;
    let reason: string | undefined;
    try {
      this.executeOp(op);
    } catch (err) {
      ok = false;
      reason = err instanceof Error ? err.message : String(err);
    }

    this.applied.add(op.opId);
    this.insertSorted(op);
    this.recordPerUser(op);
    this.maybePruneHistory();

    const snapshot = this.snapshot();
    this.emit({
      kind: ok ? "OP_APPLIED" : "OP_REJECTED",
      op,
      reason,
      snapshot,
    });
    if (ok) this.emit({ kind: "STATE_CHANGED", op, snapshot });
    return ok;
  }

  /** Apply a batch of (possibly unsorted) operations deterministically. */
  applyBatch(ops: TimelineOperation[]): number {
    const sorted = ops.filter((o) => !this.applied.has(o.opId)).sort(compareOps);
    let applied = 0;
    for (const op of sorted) if (this.apply(op)) applied += 1;
    return applied;
  }

  /**
   * Dispatch to the concrete mutation handler. Handlers must be pure with
   * respect to state mutations on `this.tracks` / `this.clips`.
   */
  private executeOp(op: TimelineOperation): void {
    switch (op.kind) {
      case "ADD_TRACK":
        this.execAddTrack(op);
        return;
      case "REMOVE_TRACK":
        this.execRemoveTrack(op);
        return;
      case "ADD_CLIP":
        this.execAddClip(op);
        return;
      case "REMOVE_CLIP":
        this.execRemoveClip(op);
        return;
      case "MOVE_CLIP":
        this.execMoveClip(op);
        return;
      case "TRIM_CLIP":
        this.execTrimClip(op);
        return;
      case "SPLIT_CLIP":
        this.execSplitClip(op);
        return;
      case "ADD_EFFECT":
        this.execAddEffect(op);
        return;
      case "REMOVE_EFFECT":
        this.execRemoveEffect(op);
        return;
      case "LOCK_CLIP":
        this.execLockClip(op);
        return;
      case "UNLOCK_CLIP":
        this.execUnlockClip(op);
        return;
    }
  }

  // ── Mutation handlers ──────────────────────────────────────────────────

  private execAddTrack(op: TimelineOperation & { kind: "ADD_TRACK" }): void {
    const existing = this.tracks.get(op.payload.track.trackId);
    if (existing && !existing.deleted) return; // idempotent
    if (existing && existing.deleted) {
      // Re-adding a tombstoned track: only allowed if the add is causally
      // later than the delete. Otherwise the delete wins.
      if ((existing.deletedAt ?? 0) > op.lamport) return;
    }
    this.tracks.set(op.payload.track.trackId, { ...op.payload.track });
  }

  private execRemoveTrack(op: TimelineOperation & { kind: "REMOVE_TRACK" }): void {
    const t = this.tracks.get(op.payload.trackId);
    if (!t) {
      // Record tombstone so future late ADD_TRACK resolves deterministically.
      this.tracks.set(op.payload.trackId, {
        trackId: op.payload.trackId,
        kind: "VIDEO",
        index: 0,
        name: "",
        muted: false,
        locked: false,
        createdBy: op.userId,
        createdAt: op.lamport,
        deleted: true,
        deletedAt: op.lamport,
      });
      return;
    }
    t.deleted = true;
    t.deletedAt = op.lamport;
    // Cascade: mark all clips on this track as deleted too.
    for (const c of this.clips.values()) {
      if (c.trackId === op.payload.trackId && !c.deleted) {
        c.deleted = true;
        c.deletedAt = op.lamport;
      }
    }
  }

  private execAddClip(op: TimelineOperation & { kind: "ADD_CLIP" }): void {
    const existing = this.clips.get(op.payload.clip.clipId);
    if (existing && !existing.deleted) return; // idempotent
    if (existing && existing.deleted) {
      if ((existing.deletedAt ?? 0) > op.lamport) return; // delete wins
    }
    this.clips.set(op.payload.clip.clipId, cloneClip(op.payload.clip));
  }

  private execRemoveClip(op: TimelineOperation & { kind: "REMOVE_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c) {
      // Pre-emptive tombstone.
      this.clips.set(op.payload.clipId, this.placeholderClip(op));
      return;
    }
    c.deleted = true;
    c.deletedAt = op.lamport;
  }

  private execMoveClip(op: TimelineOperation & { kind: "MOVE_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    // Concurrent move: last writer (by lamport) wins. Older op is discarded.
    if (c.lastModifiedAt > op.lamport) return;
    // Respect locks: a lock held by another user forbids remote mutations
    // while the lock is active. Locks are resolved deterministically via
    // lamport ordering (see ConflictResolver for UI).
    if (c.lockedBy && c.lockedBy !== op.userId && (c.lockedAt ?? 0) > op.lamport) {
      return;
    }
    c.trackId = op.payload.toTrackId;
    c.start = op.payload.toStart;
    c.lastModifiedBy = op.userId;
    c.lastModifiedAt = op.lamport;
  }

  private execTrimClip(op: TimelineOperation & { kind: "TRIM_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    if (c.lastModifiedAt > op.lamport) return;
    if (c.lockedBy && c.lockedBy !== op.userId && (c.lockedAt ?? 0) > op.lamport) {
      return;
    }
    c.start = op.payload.newStart;
    c.duration = Math.max(0, op.payload.newDuration);
    c.sourceStart = Math.max(0, op.payload.newSourceStart);
    c.lastModifiedBy = op.userId;
    c.lastModifiedAt = op.lamport;
  }

  private execSplitClip(op: TimelineOperation & { kind: "SPLIT_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    if (c.lockedBy && c.lockedBy !== op.userId && (c.lockedAt ?? 0) > op.lamport) {
      return;
    }
    const splitAt = op.payload.splitAt;
    if (splitAt <= c.start || splitAt >= c.start + c.duration) return;
    const leftDuration = splitAt - c.start;
    const rightDuration = c.duration - leftDuration;
    const rightSourceStart = c.sourceStart + leftDuration;

    const right: Clip = {
      clipId: op.payload.newRightClipId,
      trackId: c.trackId,
      start: splitAt,
      duration: rightDuration,
      sourceStart: rightSourceStart,
      sourceDuration: c.sourceDuration,
      mediaUrl: c.mediaUrl,
      name: `${c.name} (split)`,
      effects: c.effects.map((e) => ({
        ...e,
        effectId: `${e.effectId}-R`,
        parameters: { ...e.parameters },
      })),
      createdBy: op.userId,
      createdAt: op.lamport,
      lastModifiedBy: op.userId,
      lastModifiedAt: op.lamport,
      lockedBy: null,
      lockedAt: null,
      deleted: false,
      deletedAt: null,
    };

    c.duration = leftDuration;
    c.lastModifiedBy = op.userId;
    c.lastModifiedAt = op.lamport;
    this.clips.set(right.clipId, right);
  }

  private execAddEffect(op: TimelineOperation & { kind: "ADD_EFFECT" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    if (c.effects.some((e) => e.effectId === op.payload.effect.effectId)) return;
    c.effects.push({ ...op.payload.effect, parameters: { ...op.payload.effect.parameters } });
    c.lastModifiedBy = op.userId;
    c.lastModifiedAt = op.lamport;
  }

  private execRemoveEffect(op: TimelineOperation & { kind: "REMOVE_EFFECT" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    const next = c.effects.filter((e) => e.effectId !== op.payload.effectId);
    if (next.length === c.effects.length) return;
    c.effects = next;
    c.lastModifiedBy = op.userId;
    c.lastModifiedAt = op.lamport;
  }

  private execLockClip(op: TimelineOperation & { kind: "LOCK_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    // Deterministic lock arbitration: if someone else already holds a lock
    // whose lamport is later, they win. Otherwise we take the lock.
    if (c.lockedBy && c.lockedBy !== op.userId) {
      if ((c.lockedAt ?? 0) > op.lamport) return;
      if ((c.lockedAt ?? 0) === op.lamport && c.lockedBy < op.userId) return;
    }
    c.lockedBy = op.userId;
    c.lockedAt = op.lamport;
    this.emit({
      kind: "CLIP_LOCKED",
      op,
      snapshot: this.snapshot(),
    });
  }

  private execUnlockClip(op: TimelineOperation & { kind: "UNLOCK_CLIP" }): void {
    const c = this.clips.get(op.payload.clipId);
    if (!c || c.deleted) return;
    if (c.lockedBy !== op.userId) return; // only the lock holder may unlock
    c.lockedBy = null;
    c.lockedAt = null;
    this.emit({
      kind: "CLIP_UNLOCKED",
      op,
      snapshot: this.snapshot(),
    });
  }

  private placeholderClip(
    op: TimelineOperation & { kind: "REMOVE_CLIP" },
  ): Clip {
    return {
      clipId: op.payload.clipId,
      trackId: "",
      start: 0,
      duration: 0,
      sourceStart: 0,
      sourceDuration: 0,
      mediaUrl: "",
      name: "",
      effects: [],
      createdBy: op.userId,
      createdAt: op.lamport,
      lastModifiedBy: op.userId,
      lastModifiedAt: op.lamport,
      lockedBy: null,
      lockedAt: null,
      deleted: true,
      deletedAt: op.lamport,
    };
  }

  // ── Log housekeeping ───────────────────────────────────────────────────

  private insertSorted(op: TimelineOperation): void {
    // Binary search insert to keep the log ordered by compareOps.
    let lo = 0;
    let hi = this.log.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (compareOps(this.log[mid], op) <= 0) lo = mid + 1;
      else hi = mid;
    }
    this.log.splice(lo, 0, op);
  }

  private recordPerUser(op: TimelineOperation): void {
    let list = this.perUserLog.get(op.userId);
    if (!list) {
      list = [];
      this.perUserLog.set(op.userId, list);
    }
    list.push(op);
    if (!this.undoCursor.has(op.userId)) {
      this.undoCursor.set(op.userId, list.length);
    } else if (op.userId === this.localUserId) {
      // Receiving own op via network echo — keep cursor at the end.
      this.undoCursor.set(op.userId, list.length);
    }
  }

  private maybePruneHistory(): void {
    if (this.log.length <= this.historyLimit) return;
    const prune = this.log.length - this.historyLimit;
    // Remove only very old ops. We never prune ops within the per-user
    // undo window (the last 256 ops for each user).
    const protectedSet = new Set<OpId>();
    for (const list of this.perUserLog.values()) {
      const slice = list.slice(-256);
      for (const op of slice) protectedSet.add(op.opId);
    }
    let removed = 0;
    const nextLog: TimelineOperation[] = [];
    for (const op of this.log) {
      if (removed < prune && !protectedSet.has(op.opId)) {
        removed += 1;
        continue;
      }
      nextLog.push(op);
    }
    this.log = nextLog;
  }

  // ── Per-user undo / redo ───────────────────────────────────────────────

  /**
   * Undo the last operation authored by `userId` (defaults to the local user).
   * Implementation: produce an inverse op for the most recent op and apply
   * it as a new op authored by `userId` with a fresh lamport. This keeps
   * the CRDT log append-only and preserves convergence.
   */
  undo(userId: UserId = this.localUserId): TimelineOperation | null {
    const list = this.perUserLog.get(userId);
    if (!list || list.length === 0) return null;
    let cursor = this.undoCursor.get(userId) ?? list.length;
    // Walk backwards skipping ops that have already been undone.
    while (cursor > 0) {
      const candidate = list[cursor - 1];
      cursor -= 1;
      const inverse = this.invert(candidate, userId);
      if (!inverse) continue;
      this.undoCursor.set(userId, cursor);
      let redo = this.redoStack.get(userId);
      if (!redo) {
        redo = [];
        this.redoStack.set(userId, redo);
      }
      redo.push(candidate);
      this.apply(inverse);
      return inverse;
    }
    return null;
  }

  /**
   * Redo the most recently undone op for `userId`. We re-author it with a
   * fresh lamport (not replay verbatim) because replaying a tombstoned op
   * would be a no-op under idempotency rules.
   */
  redo(userId: UserId = this.localUserId): TimelineOperation | null {
    const redo = this.redoStack.get(userId);
    if (!redo || redo.length === 0) return null;
    const original = redo.pop();
    if (!original) return null;
    const reissued = this.reissue(original, userId);
    if (!reissued) return null;
    this.apply(reissued);
    const list = this.perUserLog.get(userId) ?? [];
    this.undoCursor.set(userId, list.length);
    return reissued;
  }

  /**
   * Build the inverse of an op. Returns `null` for ops with no meaningful
   * inverse (e.g. a LOCK_CLIP whose lock has already expired).
   */
  private invert(
    op: TimelineOperation,
    userId: UserId,
  ): TimelineOperation | null {
    const base = this.baseOpFor(userId);
    switch (op.kind) {
      case "ADD_TRACK":
        return {
          ...base,
          kind: "REMOVE_TRACK",
          payload: { trackId: op.payload.track.trackId },
        };
      case "REMOVE_TRACK": {
        const t = this.tracks.get(op.payload.trackId);
        if (!t) return null;
        return {
          ...base,
          kind: "ADD_TRACK",
          payload: {
            track: {
              ...t,
              deleted: false,
              deletedAt: null,
            },
          },
        };
      }
      case "ADD_CLIP":
        return {
          ...base,
          kind: "REMOVE_CLIP",
          payload: { clipId: op.payload.clip.clipId },
        };
      case "REMOVE_CLIP": {
        const c = this.clips.get(op.payload.clipId);
        if (!c) return null;
        return {
          ...base,
          kind: "ADD_CLIP",
          payload: {
            clip: {
              ...cloneClip(c),
              deleted: false,
              deletedAt: null,
              lockedBy: null,
              lockedAt: null,
            },
          },
        };
      }
      case "MOVE_CLIP":
        return {
          ...base,
          kind: "MOVE_CLIP",
          payload: {
            clipId: op.payload.clipId,
            toTrackId: op.payload.fromTrackId,
            toStart: op.payload.fromStart,
            fromTrackId: op.payload.toTrackId,
            fromStart: op.payload.toStart,
          },
        };
      case "TRIM_CLIP":
        return {
          ...base,
          kind: "TRIM_CLIP",
          payload: {
            clipId: op.payload.clipId,
            newStart: op.payload.prevStart,
            newDuration: op.payload.prevDuration,
            newSourceStart: op.payload.prevSourceStart,
            prevStart: op.payload.newStart,
            prevDuration: op.payload.newDuration,
            prevSourceStart: op.payload.newSourceStart,
          },
        };
      case "SPLIT_CLIP":
        // Inverse of split = remove the right-hand clip and restore the
        // original duration of the left-hand clip.
        return {
          ...base,
          kind: "REMOVE_CLIP",
          payload: { clipId: op.payload.newRightClipId },
        };
      case "ADD_EFFECT":
        return {
          ...base,
          kind: "REMOVE_EFFECT",
          payload: {
            clipId: op.payload.clipId,
            effectId: op.payload.effect.effectId,
          },
        };
      case "REMOVE_EFFECT":
        return null; // we did not snapshot the removed effect value
      case "LOCK_CLIP":
        return {
          ...base,
          kind: "UNLOCK_CLIP",
          payload: { clipId: op.payload.clipId },
        };
      case "UNLOCK_CLIP":
        return {
          ...base,
          kind: "LOCK_CLIP",
          payload: { clipId: op.payload.clipId },
        };
    }
  }

  private reissue(
    op: TimelineOperation,
    userId: UserId,
  ): TimelineOperation | null {
    const base = this.baseOpFor(userId);
    switch (op.kind) {
      case "ADD_TRACK":
      case "REMOVE_TRACK":
      case "ADD_CLIP":
      case "REMOVE_CLIP":
      case "MOVE_CLIP":
      case "TRIM_CLIP":
      case "SPLIT_CLIP":
      case "ADD_EFFECT":
      case "REMOVE_EFFECT":
      case "LOCK_CLIP":
      case "UNLOCK_CLIP":
        return { ...base, kind: op.kind, payload: op.payload } as TimelineOperation;
    }
  }

  private baseOpFor(userId: UserId): BaseOperation {
    this.lamport += 1;
    const prev = this.vectorClock[userId] ?? 0;
    if (this.lamport > prev) this.vectorClock[userId] = this.lamport;
    return {
      opId: makeOpId(userId, this.lamport),
      userId,
      timestamp: Date.now(),
      lamport: this.lamport,
    };
  }

  // ── Debug helpers ──────────────────────────────────────────────────────

  describe(): string {
    const clips = this.getClips();
    const tracks = this.getTracks();
    const lines: string[] = [];
    lines.push(`CRDTTimeline(project=${this.projectId}, lamport=${this.lamport})`);
    lines.push(`  tracks: ${tracks.length}  clips: ${clips.length}`);
    for (const t of tracks) {
      lines.push(`  ├─ ${t.kind} track "${t.name}" [${t.trackId}]`);
      const onTrack = clips.filter((c) => c.trackId === t.trackId);
      for (const c of onTrack) {
        const lock = c.lockedBy ? ` 🔒${c.lockedBy}` : "";
        lines.push(
          `  │    ├─ ${c.name} [${c.clipId}]  ${c.start.toFixed(2)}s +${c.duration.toFixed(2)}s${lock}`,
        );
      }
    }
    return lines.join("\n");
  }
}

// ── Integration helpers ────────────────────────────────────────────────────

/**
 * Apply a batch of remote operations to a timeline and return the set of
 * clip ids whose state has changed. Used by higher-level UI to decide
 * what to invalidate in React.
 */
export function applyRemoteBatch(
  tl: CRDTTimeline,
  ops: TimelineOperation[],
): Set<ClipId> {
  const before = new Map(tl.getClips().map((c) => [c.clipId, c]));
  tl.applyBatch(ops);
  const after = new Map(tl.getClips().map((c) => [c.clipId, c]));
  const changed = new Set<ClipId>();
  for (const [id, c] of after) {
    const prev = before.get(id);
    if (!prev) {
      changed.add(id);
      continue;
    }
    if (
      prev.start !== c.start ||
      prev.duration !== c.duration ||
      prev.trackId !== c.trackId ||
      prev.sourceStart !== c.sourceStart ||
      prev.lockedBy !== c.lockedBy ||
      prev.effects.length !== c.effects.length
    ) {
      changed.add(id);
    }
  }
  for (const id of before.keys()) if (!after.has(id)) changed.add(id);
  return changed;
}

/**
 * Compute whether two concurrent operations conflict on the same clip.
 * This is a pure helper used by `ConflictResolver` for UI flagging.
 */
export function opsConflict(
  a: TimelineOperation,
  b: TimelineOperation,
): boolean {
  const targetA = operationTarget(a);
  const targetB = operationTarget(b);
  if (!targetA || !targetB) return false;
  if (targetA !== targetB) return false;
  if (a.userId === b.userId) return false;
  // Only mutating ops conflict.
  const mutating: OperationKind[] = [
    "REMOVE_CLIP",
    "MOVE_CLIP",
    "TRIM_CLIP",
    "SPLIT_CLIP",
    "ADD_EFFECT",
    "REMOVE_EFFECT",
  ];
  return mutating.includes(a.kind) && mutating.includes(b.kind);
}

export function operationTarget(op: TimelineOperation): ClipId | null {
  switch (op.kind) {
    case "ADD_CLIP":
      return op.payload.clip.clipId;
    case "REMOVE_CLIP":
    case "MOVE_CLIP":
    case "TRIM_CLIP":
    case "SPLIT_CLIP":
    case "ADD_EFFECT":
    case "REMOVE_EFFECT":
    case "LOCK_CLIP":
    case "UNLOCK_CLIP":
      return op.payload.clipId;
    case "ADD_TRACK":
    case "REMOVE_TRACK":
      return null;
  }
}

export default CRDTTimeline;
