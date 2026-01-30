/**
 * Theme Inline Script Generator
 *
 * This generates the script that goes in index.html <head>
 * to prevent FOUC (Flash of Unstyled Content).
 *
 * Run: bun run build:theme-script
 */

// Embedded light theme (minimal for FOUC prevention)
const LIGHT_COLORS = {
  "--color-bg-primary": "#ffffff",
  "--color-bg-secondary": "#f9fafb",
  "--color-bg-surface": "#ffffff",
  "--color-text-primary": "#111827",
  "--color-text-secondary": "#4b5563",
  "--color-accent": "#2563eb",
  "--color-border": "#e5e7eb",
};

// Embedded dark theme (minimal for FOUC prevention)
const DARK_COLORS = {
  "--color-bg-primary": "#0a0a0b",
  "--color-bg-secondary": "#111113",
  "--color-bg-surface": "#1f1f23",
  "--color-text-primary": "#fafafa",
  "--color-text-secondary": "#a1a1aa",
  "--color-accent": "#3b82f6",
  "--color-border": "#27272a",
};

/**
 * The inline script to embed in index.html
 * Minified version goes in the actual HTML
 */
export const THEME_INLINE_SCRIPT = `
(function(){
  var PREF_KEY='cove:theme-preference';
  var CACHE_KEY='cove:theme-cache';
  var LIGHT=${JSON.stringify(LIGHT_COLORS)};
  var DARK=${JSON.stringify(DARK_COLORS)};
  
  try{
    var pref=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');
    var selected=pref.selected||'system';
    var cached=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
    var colors=null;
    var appearance='dark';
    
    if(selected==='system'){
      var prefersDark=window.matchMedia('(prefers-color-scheme:dark)').matches;
      var themeId=prefersDark?(pref.darkTheme||'dark'):(pref.lightTheme||'light');
      if(cached&&cached.id===themeId){
        colors=cached.colors;
        appearance=cached.appearance;
      }else{
        colors=themeId==='light'?LIGHT:DARK;
        appearance=themeId==='light'?'light':'dark';
      }
    }else{
      if(cached&&cached.id===selected){
        colors=cached.colors;
        appearance=cached.appearance;
      }else if(selected==='light'){
        colors=LIGHT;
        appearance='light';
      }else{
        colors=DARK;
        appearance='dark';
      }
    }
    
    if(colors){
      var root=document.documentElement;
      for(var k in colors){
        root.style.setProperty(k,colors[k]);
      }
      root.setAttribute('data-appearance',appearance);
    }
    
    var meta=document.querySelector('meta[name="theme-color"]');
    if(meta){
      meta.setAttribute('content',colors['--color-bg-primary']||(appearance==='dark'?'#0a0a0b':'#ffffff'));
    }
  }catch(e){}
})();
`.trim();

// Export for use in build scripts
export { LIGHT_COLORS, DARK_COLORS };
