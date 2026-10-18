export { startRecording } from "./recorder.js";
export type { Recording, RecordingFormat, RecordingResult, StartRecordingOptions } from "./recorder.js";
export { createEventLogger, describeTarget, isSensitiveElement, labelFor, selectorFor } from "./event-log.js";
export type { EventLogger, EventLoggerOptions } from "./event-log.js";
export { eventsOfType, placeCamera, sessionCommands, toVideoFraction } from "./project.js";
export type { CameraCorner, Command, PlaceCameraOptions, SessionCommandsOptions } from "./project.js";
export { parseCaptureSession } from "./session.js";
export { isRecordingFile, packRecording, RECORDING_FILE_EXTENSION, RECORDING_FILE_TYPE, unpackRecording } from "./bundle.js";
export type { RecordingFiles } from "./bundle.js";
export { estimateViewportInVideo, eventToFrame, fitResizedEvents, pageInFrame } from "./surface.js";
export type { DisplaySurface, VideoFrameSize, WindowGeometry } from "./surface.js";
export type {
  CaptureEvent,
  CaptureEventType,
  CaptureMedia,
  CaptureRect,
  CaptureSession,
  CaptureTarget,
  CaptureUs,
  PointerEventData,
} from "./types.js";
