export const SHOW_DEBUG_UI = !!import.meta.env.VITE_SHOW_DEBUG_UI;
export const SHOW_DEV_TOOLS = import.meta.env.DEV || SHOW_DEBUG_UI;
