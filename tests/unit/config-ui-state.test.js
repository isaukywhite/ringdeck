import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';

// Must set up globalThis.api BEFORE state.js is imported (it runs api.getTelemetryConsent at top-level)
// vi.hoisted runs before any imports
const mockApi = vi.hoisted(() => {
  const api = {
    getTelemetryConsent: vi.fn().mockResolvedValue(false),
  };
  globalThis.api = api;
  return api;
});

import {
  getConfig, setConfig,
  getActiveProfileIndex, setActiveProfileIndex,
  getExpandedSlice, setExpandedSlice,
  getPickerOpen, setPickerOpen,
  getDragSrcIndex, setDragSrcIndex,
  getActiveRecorder, setActiveRecorder,
  getSentryEnabled, setSentryEnabled,
  getActiveView, setActiveView,
  getAppVersion, setAppVersion,
  activeProfile,
} from '../../src/config-ui/state.js';

describe('config-ui/state', () => {
  beforeEach(() => {
    setConfig({ profiles: [] });
    setActiveProfileIndex(0);
    setExpandedSlice(-1);
    setPickerOpen(false);
    setDragSrcIndex(-1);
    setActiveRecorder(null);
    setSentryEnabled(false);
    setActiveView('actions');
    setAppVersion('');
  });

  it('getConfig / setConfig round-trips', () => {
    const cfg = { profiles: [{ name: 'Test' }] };
    setConfig(cfg);
    expect(getConfig()).toBe(cfg);
  });

  it('getActiveProfileIndex / setActiveProfileIndex', () => {
    expect(getActiveProfileIndex()).toBe(0);
    setActiveProfileIndex(2);
    expect(getActiveProfileIndex()).toBe(2);
  });

  it('getExpandedSlice / setExpandedSlice', () => {
    expect(getExpandedSlice()).toBe(-1);
    setExpandedSlice(3);
    expect(getExpandedSlice()).toBe(3);
  });

  it('getPickerOpen / setPickerOpen', () => {
    expect(getPickerOpen()).toBe(false);
    setPickerOpen(true);
    expect(getPickerOpen()).toBe(true);
  });

  it('getDragSrcIndex / setDragSrcIndex', () => {
    expect(getDragSrcIndex()).toBe(-1);
    setDragSrcIndex(5);
    expect(getDragSrcIndex()).toBe(5);
  });

  it('getActiveRecorder / setActiveRecorder', () => {
    expect(getActiveRecorder()).toBeNull();
    const rec = { cleanup: vi.fn() };
    setActiveRecorder(rec);
    expect(getActiveRecorder()).toBe(rec);
  });

  it('getSentryEnabled / setSentryEnabled', () => {
    setSentryEnabled(true);
    expect(getSentryEnabled()).toBe(true);
    setSentryEnabled(false);
    expect(getSentryEnabled()).toBe(false);
  });

  it('activeProfile returns first profile when index is 0', () => {
    setConfig({ profiles: [{ name: 'A', slices: [] }, { name: 'B', slices: [] }] });
    setActiveProfileIndex(0);
    expect(activeProfile().name).toBe('A');
  });

  it('activeProfile returns correct profile for non-zero index', () => {
    setConfig({ profiles: [{ name: 'A', slices: [] }, { name: 'B', slices: [] }] });
    setActiveProfileIndex(1);
    expect(activeProfile().name).toBe('B');
  });

  it('activeProfile falls back to profiles[0] if index out of range', () => {
    setConfig({ profiles: [{ name: 'Only', slices: [] }] });
    setActiveProfileIndex(99);
    expect(activeProfile().name).toBe('Only');
  });

  it('activeProfile returns undefined when profiles is empty', () => {
    setConfig({ profiles: [] });
    expect(activeProfile()).toBeUndefined();
  });

  it('getActiveView / setActiveView', () => {
    expect(getActiveView()).toBe('actions');
    setActiveView('settings');
    expect(getActiveView()).toBe('settings');
  });

  it('getAppVersion / setAppVersion', () => {
    expect(getAppVersion()).toBe('');
    setAppVersion('v0.2.3');
    expect(getAppVersion()).toBe('v0.2.3');
  });
});
