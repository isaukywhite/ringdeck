import {
  getConfig, setActiveProfileIndex, setExpandedSlice,
  getActiveProfileIndex,
} from './state.js';
import { render } from './render.js';

export function addProfile() {
  const config = getConfig();
  const id = 'profile_' + Date.now();
  config.profiles.push({
    id,
    name: "New Profile",
    shortcut: "",
    slices: [],
  });
  setActiveProfileIndex(config.profiles.length - 1);
  setExpandedSlice(-1);
  render();
}

export function deleteProfile() {
  const config = getConfig();
  if (config.profiles.length <= 1) return;
  const activeProfileIndex = getActiveProfileIndex();
  config.profiles.splice(activeProfileIndex, 1);
  if (activeProfileIndex >= config.profiles.length) {
    setActiveProfileIndex(config.profiles.length - 1);
  }
  setExpandedSlice(-1);
  render();
}
