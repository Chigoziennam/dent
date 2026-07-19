// Syntax-check every Code node the way n8n compiles it. `node --check` is no
// use here: it rejects the top-level return that n8n supplies a wrapper for,
// so it reports a false error and hides the real ones.
// Twice now a stray backtick inside the LAWS template literal closed the
// string early and took down every AI call with "Unexpected identifier".
const d = require('./1-shiplog-ai-writer.json')
let bad = 0
for (const n of d.nodes) {
  const c = n.parameters && n.parameters.jsCode
  if (!c) continue
  try { new Function('$', '$input', '$now', c); console.log('✅', n.name) }
  catch (e) { bad++; console.log('❌', n.name, '—', e.message) }
}
process.exit(bad ? 1 : 0)
