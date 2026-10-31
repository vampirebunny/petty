import { runwayPose, runwaySteps, type RunwayStepId } from '../actor/data/strut';
import { runwayConfig } from './config';
import type { LocalRunwayShow, RunwaySubmission } from './types';

export type RunwayModelOrder = {
  submission: RunwaySubmission;
  isViewer: boolean;
};

export function modelsForViewer(show: LocalRunwayShow, viewerSubmissionId?: string): RunwayModelOrder[] {
  const sorted = [...show.submissions].sort((a, b) => a.submittedAt - b.submittedAt);
  if (!viewerSubmissionId) {
    return sorted.map((submission) => ({ submission, isViewer: false }));
  }
  const self = sorted.find((row) => row.submissionId === viewerSubmissionId);
  const others = sorted.filter((row) => row.submissionId !== viewerSubmissionId);
  if (!self) {
    return others.map((submission) => ({ submission, isViewer: false }));
  }
  return [{ submission: self, isViewer: true }, ...others.map((submission) => ({ submission, isViewer: false }))];
}

export type PlaybackBeat = {
  lookIndex: number;
  modelIndex: number;
  stepId: RunwayStepId;
  seconds: number;
};

export function buildBeats(show: LocalRunwayShow, viewerSubmissionId?: string): PlaybackBeat[] {
  const models = modelsForViewer(show, viewerSubmissionId);
  const beats: PlaybackBeat[] = [];
  const steps = runwayConfig.poseEnabled ? runwaySteps : runwaySteps.filter((step) => step.id !== 'pose');
  for (let lookIndex = 0; lookIndex < runwayConfig.looksPerModel; lookIndex += 1) {
    for (let modelIndex = 0; modelIndex < models.length; modelIndex += 1) {
      for (const step of steps) {
        beats.push({ lookIndex, modelIndex, stepId: step.id, seconds: step.seconds });
      }
    }
  }
  return beats;
}

export function venueScrolls(stepId: RunwayStepId): 'still' | 'out' | 'back' {
  if (stepId === 'walkOut') {
    return 'out';
  }
  if (stepId === 'walkBack') {
    return 'back';
  }
  return 'still';
}

export function poseForStep(stepId: RunwayStepId): Partial<typeof runwayPose> | null {
  if (stepId === 'pose' && runwayConfig.poseEnabled) {
    return runwayPose;
  }
  return null;
}

export function skipToNextModel(beats: PlaybackBeat[], index: number): number {
  if (index < 0 || index >= beats.length) {
    return beats.length;
  }
  const { lookIndex, modelIndex } = beats[index];
  for (let i = index + 1; i < beats.length; i += 1) {
    if (beats[i].lookIndex !== lookIndex || beats[i].modelIndex !== modelIndex) {
      return i;
    }
  }
  return beats.length;
}

export function skipToNextRound(beats: PlaybackBeat[], index: number): number {
  if (index < 0 || index >= beats.length) {
    return beats.length;
  }
  const { lookIndex } = beats[index];
  for (let i = index + 1; i < beats.length; i += 1) {
    if (beats[i].lookIndex !== lookIndex) {
      return i;
    }
  }
  return beats.length;
}
