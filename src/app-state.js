import { MODES, normalizeMode } from "./core.js";

// Intent changes live here; native window effects stay in main.js. Recovery and
// menu events deliberately have no reveal action, so a manual hide survives them.
export function transitionState(state, action) {
  switch (action.type) {
    case "mode": {
      const mode = normalizeMode(action.mode);
      if (!Object.values(MODES).includes(mode)) return state;
      return { mode, chatOpen: false, manualHidden: false, controlActive: false };
    }
    case "chat":
      return {
        mode: state.mode === MODES.BEANS ? MODES.PET : state.mode,
        chatOpen: true,
        manualHidden: false,
        controlActive: false,
      };
    case "dismiss-chat":
      return { ...state, chatOpen: false, controlActive: false };
    case "hide":
      return { ...state, manualHidden: true, controlActive: false };
    case "reveal":
      return { ...state, manualHidden: false, controlActive: false };
    case "focus":
      return {
        ...state,
        controlActive: state.mode === MODES.PET && !state.chatOpen && !state.manualHidden,
      };
    case "release-control":
      return { ...state, controlActive: false };
    default:
      return state;
  }
}
