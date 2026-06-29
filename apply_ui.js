const fs = require('fs');

let css = fs.readFileSync('styles.css', 'utf8');

// 1. Typography & Scrollbars
css = css.replace(/font-weight: 300;/, 'font-weight: 400;\n  letter-spacing: -0.2px;');
if (!css.includes('::-webkit-scrollbar')) {
  css += '\n::-webkit-scrollbar { width: 8px; height: 8px; }\n::-webkit-scrollbar-track { background: transparent; }\n::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }\n::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }\n';
}

// 2. Glassmorphism Topbar
css = css.replace(/\.gemini-topbar \{[\s\S]*?min-height: 56px;/m, '.gemini-topbar {\n  display: flex;\n  justify-content: space-between;\n  align-items: center;\n  position: sticky;\n  top: 0;\n  z-index: 50;\n  background: rgba(10, 12, 16, 0.6);\n  backdrop-filter: blur(25px);\n  -webkit-backdrop-filter: blur(25px);\n  border-bottom: 1px solid rgba(255, 255, 255, 0.05);\n  min-height: 56px;');

// Glassmorphism Composer
css = css.replace(/\.composer\.glassy-pill \{[\s\S]*?box-shadow: 0 4px 30px rgba\(0,0,0,0\.3\);/m, '.composer.glassy-pill {\n  display: flex;\n  align-items: center;\n  background: rgba(30, 30, 32, 0.5);\n  backdrop-filter: blur(25px);\n  -webkit-backdrop-filter: blur(25px);\n  border-radius: 40px;\n  padding: 8px 8px 8px 16px;\n  margin: 0 auto 20px;\n  width: 100%;\n  max-width: 820px;\n  border: 1px solid rgba(255,255,255,0.1);\n  box-shadow: 0 10px 40px rgba(0,0,0,0.4);');

// 3. Message Entrance Animation
css = css.replace(/\.message \{[\s\S]*?width: max-content;/m, '$&\n  animation: messageSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;');
if (!css.includes('@keyframes messageSlideIn')) {
  css += '\n@keyframes messageSlideIn {\n  from { opacity: 0; transform: translateY(20px) scale(0.98); }\n  to { opacity: 1; transform: translateY(0) scale(1); }\n}\n';
}

// Hover effects
css = css.replace(/\.pill-action \{[\s\S]*?border: none;/m, '$&\n  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease;');
if (!css.includes('.pill-action:hover')) {
  css += '\n.pill-action:hover { transform: scale(1.1); background: rgba(255,255,255,0.1); }\n';
}

css = css.replace(/\.gemini-blue-btn \{[\s\S]*?padding: 0 !important;/m, '$&\n  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease !important;');
if (!css.includes('.gemini-blue-btn:hover')) {
  css += '\n.gemini-blue-btn:hover { transform: scale(1.1) translateY(-2px); box-shadow: 0 10px 25px rgba(59, 130, 246, 0.5) !important; }\n';
}

// 4. Glowing Orb CSS
if (!css.includes('.thinking-orb')) {
  css += '\n.thinking-orb { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--teal), var(--rose)); box-shadow: 0 0 15px rgba(167, 139, 250, 0.8), 0 0 30px rgba(56, 242, 208, 0.6); animation: orbPulse 1.5s ease-in-out infinite alternate; margin-left: 8px; }\n@keyframes orbPulse { from { transform: scale(0.9); box-shadow: 0 0 10px rgba(167, 139, 250, 0.5); } to { transform: scale(1.2); box-shadow: 0 0 25px rgba(167, 139, 250, 1), 0 0 40px rgba(56, 242, 208, 0.9); } }\n';
}

fs.writeFileSync('styles.css', css, 'utf8');

let html = fs.readFileSync('index.html', 'utf8');
const newOrb = `<div id="thinkingIndicator" class="thinking hidden" aria-live="polite">
              <div class="thinking-orb"></div>
              <div class="thinking-body" style="margin-left: 12px;">
                <span class="thinking-text" style="font-size: 16px;">Luvia is thinking...</span>
              </div>
            </div>`;

let rgx = /<div id="thinkingIndicator" class="thinking hidden" aria-live="polite">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;
// Wait, the thinkingIndicator HTML in index.html has 3 closing divs:
// <div id="thinkingIndicator" ...>
//   <div class="thinking-icon">...</div>
//   <div class="thinking-body">...</div>
// </div>
// That's exactly 1 closing div for thinkingIndicator. Let's make sure the regex matches perfectly.
let rgx2 = /<div id="thinkingIndicator" class="thinking hidden" aria-live="polite">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/; // Wait, actually I can just use string replace.
// Let's do a reliable replacement by reading between `<div id="thinkingIndicator"` and `<div id="smartSuggestions"`.
let startIdx = html.indexOf('<div id="thinkingIndicator"');
let endIdx = html.indexOf('<div id="smartSuggestions"');
if(startIdx !== -1 && endIdx !== -1) {
  html = html.substring(0, startIdx) + newOrb + '\n            ' + html.substring(endIdx);
}
fs.writeFileSync('index.html', html, 'utf8');
console.log('UI Upgrades applied successfully');
