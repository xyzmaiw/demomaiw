import type {
  CaptureProject,
  ClickEvent,
  DemoEvent,
  ExportSettings,
  ProjectAspectRatio,
  FrameMode,
  ProjectMedia,
  TextCardEvent,
  FreezeEvent,
  CropState,
  CardPosition,
} from '@/types'
import {
  DEFAULT_CARD_DURATION_MS,
  DEFAULT_RING_DURATION_MS,
  DEFAULT_ZOOM_HOLD_MS,
  DEFAULT_ZOOM_STRENGTH,
  preferLabelPositionAwayFromClick,
} from '@/lib/animations'
import { createId } from '@/lib/utils'

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  resolution: 'original',
  fps: 30,
  format: 'webm',
  roundedFrame: false,
  background: 'solid',
  backgroundColor: '#0a0a0b',
}

export const DEFAULT_CROP: CropState = {
  focalX: 0.5,
  focalY: 0.5,
}

export function createProject(media: ProjectMedia, name?: string): CaptureProject {
  return {
    id: createId('project'),
    name: name ?? (media.kind === 'video' ? 'Untitled demo' : 'Untitled screenshot'),
    media,
    events: [],
    aspectRatio: 'original',
    frameMode: 'fit',
    crop: { ...DEFAULT_CROP },
    exportSettings: {
      ...DEFAULT_EXPORT_SETTINGS,
      format: media.kind === 'screenshot' ? 'png' : 'webm',
    },
    createdAt: Date.now(),
  }
}

export type ProjectAction =
  | { type: 'SET_MEDIA'; media: ProjectMedia }
  | { type: 'SET_ASPECT_RATIO'; aspectRatio: ProjectAspectRatio }
  | { type: 'SET_FRAME_MODE'; frameMode: FrameMode }
  | { type: 'SET_CROP'; crop: Partial<CropState> }
  | { type: 'SET_EXPORT_SETTINGS'; settings: Partial<ExportSettings> }
  | { type: 'ADD_EVENT'; event: DemoEvent }
  | { type: 'UPDATE_EVENT'; id: string; patch: Partial<DemoEvent> }
  | { type: 'DELETE_EVENT'; id: string }
  | { type: 'SELECT_EVENT'; id: string | null }
  | { type: 'CLEAR_PROJECT' }
  | { type: 'REPLACE_PROJECT'; project: CaptureProject }
  | { type: 'SET_NAME'; name: string }

export interface ProjectStoreState {
  project: CaptureProject | null
  selectedEventId: string | null
}

export const initialProjectState: ProjectStoreState = {
  project: null,
  selectedEventId: null,
}

export function projectReducer(
  state: ProjectStoreState,
  action: ProjectAction,
): ProjectStoreState {
  switch (action.type) {
    case 'CLEAR_PROJECT':
      return { project: null, selectedEventId: null }

    case 'REPLACE_PROJECT':
      return { project: action.project, selectedEventId: null }

    case 'SET_MEDIA': {
      if (!state.project) return state
      return {
        ...state,
        project: { ...state.project, media: action.media },
      }
    }

    case 'SET_NAME': {
      if (!state.project) return state
      return {
        ...state,
        project: { ...state.project, name: action.name },
      }
    }

    case 'SET_ASPECT_RATIO': {
      if (!state.project) return state
      return {
        ...state,
        project: { ...state.project, aspectRatio: action.aspectRatio },
      }
    }

    case 'SET_FRAME_MODE': {
      if (!state.project) return state
      return {
        ...state,
        project: { ...state.project, frameMode: action.frameMode },
      }
    }

    case 'SET_CROP': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          crop: { ...state.project.crop, ...action.crop },
        },
      }
    }

    case 'SET_EXPORT_SETTINGS': {
      if (!state.project) return state
      return {
        ...state,
        project: {
          ...state.project,
          exportSettings: { ...state.project.exportSettings, ...action.settings },
        },
      }
    }

    case 'ADD_EVENT': {
      if (!state.project) return state
      const events = [...state.project.events, action.event].sort(
        (a, b) => a.startTimeMs - b.startTimeMs,
      )
      return {
        selectedEventId: action.event.id,
        project: { ...state.project, events },
      }
    }

    case 'UPDATE_EVENT': {
      if (!state.project) return state
      const events = state.project.events.map((event) => {
        if (event.id !== action.id) return event
        return { ...event, ...action.patch, id: event.id, type: event.type } as DemoEvent
      })
      return {
        ...state,
        project: { ...state.project, events },
      }
    }

    case 'DELETE_EVENT': {
      if (!state.project) return state
      return {
        selectedEventId:
          state.selectedEventId === action.id ? null : state.selectedEventId,
        project: {
          ...state.project,
          events: state.project.events.filter((e) => e.id !== action.id),
        },
      }
    }

    case 'SELECT_EVENT':
      return { ...state, selectedEventId: action.id }

    default:
      return state
  }
}

export function createManualClickEvent(
  x: number,
  y: number,
  startTimeMs: number,
  label = 'Click',
): ClickEvent {
  return {
    id: createId('click'),
    type: 'click',
    x,
    y,
    startTimeMs,
    ringDurationMs: DEFAULT_RING_DURATION_MS,
    zoomEnabled: true,
    zoomStrength: DEFAULT_ZOOM_STRENGTH,
    zoomHoldDurationMs: DEFAULT_ZOOM_HOLD_MS,
    label,
    labelPosition: preferLabelPositionAwayFromClick(x, y),
    source: 'manual',
  }
}

export function createTextCardEvent(
  text: string,
  startTimeMs: number,
  position: CardPosition = 'bottom-center',
  durationMs = DEFAULT_CARD_DURATION_MS,
): TextCardEvent {
  return {
    id: createId('card'),
    type: 'text-card',
    text,
    startTimeMs,
    durationMs,
    position,
  }
}

export function createFreezeEvent(startTimeMs: number, durationMs = 800): FreezeEvent {
  return {
    id: createId('freeze'),
    type: 'freeze',
    startTimeMs,
    durationMs,
    experimental: true,
  }
}
