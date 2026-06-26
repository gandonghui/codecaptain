import type { Session } from '@opencode-ai/sdk/v2';

export type SessionMetadataRecord = Record<string, unknown>;

type CodeCaptainMetadata = {
  kind?: 'review';
  originalSessionID?: string;
  reviewSessionID?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const getSessionMetadata = (session: Session | null | undefined): SessionMetadataRecord => {
  const metadata = (session as (Session & { metadata?: unknown }) | null | undefined)?.metadata;
  return isRecord(metadata) ? metadata : {};
};

const getCodeCaptainMetadata = (metadata: SessionMetadataRecord): CodeCaptainMetadata => {
  const value = metadata.codecaptain;
  return isRecord(value) ? value as CodeCaptainMetadata : {};
};

export const getReviewSessionID = (session: Session | null | undefined): string | null => {
  const value = getCodeCaptainMetadata(getSessionMetadata(session)).reviewSessionID;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const getOriginalSessionID = (session: Session | null | undefined): string | null => {
  const value = getCodeCaptainMetadata(getSessionMetadata(session)).originalSessionID;
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

export const isReviewSession = (session: Session | null | undefined): boolean =>
  getCodeCaptainMetadata(getSessionMetadata(session)).kind === 'review' && Boolean(getOriginalSessionID(session));

export const withReviewSessionLink = (
  metadata: SessionMetadataRecord,
  reviewSessionID: string,
): SessionMetadataRecord => {
  const current = getCodeCaptainMetadata(metadata);
  return {
    ...metadata,
    codecaptain: {
      ...current,
      reviewSessionID,
    },
  };
};

export const withReviewSessionMarker = (
  metadata: SessionMetadataRecord,
  originalSessionID: string,
): SessionMetadataRecord => {
  const current = getCodeCaptainMetadata(metadata);
  return {
    ...metadata,
    codecaptain: {
      ...current,
      kind: 'review' as const,
      originalSessionID,
    },
  };
};

export const withoutReviewSessionLink = (
  metadata: SessionMetadataRecord,
  reviewSessionID: string,
): SessionMetadataRecord => {
  const current = getCodeCaptainMetadata(metadata);
  if (current.reviewSessionID !== reviewSessionID) return metadata;

  const restCodeCaptain = { ...current };
  delete restCodeCaptain.reviewSessionID;
  const next: SessionMetadataRecord = { ...metadata };
  if (Object.keys(restCodeCaptain).length > 0) {
    next.codecaptain = restCodeCaptain;
  } else {
    delete next.codecaptain;
  }
  return next;
};
