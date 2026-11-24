import { STORAGE_KEY, DARK_QUERY, THEME_COLORS } from './theme'

// Blocking inline script for <head> (rendered by components/theme-head.js in all
// three root layouts). It runs before first paint, so the server HTML is never
// painted in the wrong theme. Mirrors readStoredPref + applyTheme in lib/theme.js
// (hand-minimised because it cannot import); test/theme.test.js runs it against
// the real functions to keep the two in lockstep. Never adds the cross-fade class.
export const THEME_SCRIPT = `(function(){try{var p=null;try{p=localStorage.getItem(${JSON.stringify(STORAGE_KEY)})}catch(e){}if(p!=="light"&&p!=="dark")p="system";var d=p==="dark"||(p==="system"&&window.matchMedia(${JSON.stringify(DARK_QUERY)}).matches);var h=document.documentElement;h.classList.toggle("dark",d);h.dataset.themePref=p;h.style.colorScheme=d?"dark":"light";var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",d?${JSON.stringify(THEME_COLORS.dark)}:${JSON.stringify(THEME_COLORS.light)})}catch(e){}})()`
