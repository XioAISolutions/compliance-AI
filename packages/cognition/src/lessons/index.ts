export type {
  Lesson,
  LessonCandidate,
  LessonRelation,
  LessonRelationType,
  LessonSource,
  LessonStatus,
  LessonStore,
} from "./types.js";
export { InMemoryLessonStore } from "./in-memory-store.js";
export {
  cosineSimilarity,
  DeterministicEmbedder,
  OpenAIEmbedder,
  defaultEmbedder,
  type Embedder,
} from "./embedding.js";
export { CognitionSidecar, type SidecarOptions, type SidecarResult, type SidecarAction } from "./sidecar.js";
export {
  ResourceCalculator,
  type ResourceBudget,
  type CycleVerdict,
} from "./resources.js";
export {
  pickAmbientProvider,
  listAmbientProviders,
  type AmbientProvider,
  type AmbientProviderId,
} from "./provider.js";
export {
  FileBackedWakeQueue,
  InMemoryWakeQueue,
  type WakeEnvelope,
  type WakeQueue,
  type WakeTrigger,
} from "./queue.js";
export {
  CognitionGarden,
  type GardenCycleInput,
  type GardenCycleReport,
  type GardenOptions,
  type GardenStepResult,
} from "./garden.js";
export { GardenScheduler, type SchedulerOptions } from "./scheduler.js";
export {
  InMemoryMetrics,
  type MetricsRecorder,
  type MetricsSnapshot,
  type SidecarSample,
} from "./metrics.js";
export { detectContradiction, type ContradictionResult } from "./contradiction.js";
export { parseCrumbToCandidates, type ParseCrumbOptions } from "./crumb.js";
