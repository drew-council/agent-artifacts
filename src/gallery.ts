export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				char
			] ?? char,
	);
}
// Catppuccin Mocha with mauve accents. Fonts are local-only: the gallery CSP blocks downloads.
const css = `
:root{color-scheme:dark;--bg:#1e1e2e;--fg:#cdd6f4;--muted:#a6adc8;--line:#45475a;--surface:#181825;--raised:#313244;--accent:#cba6f7;--crust:#11111b;--sans:"Noto Sans Variable","Noto Sans",system-ui,sans-serif;--mono:"JetBrains Mono Variable","JetBrains Mono",ui-monospace,monospace}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 var(--sans)}main,header{max-width:1100px;margin:auto;padding:28px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}h1{font-size:clamp(28px,4vw,42px);letter-spacing:-.03em;margin:0}h2{font-size:23px;line-height:1.3;margin:10px 0}p{margin:8px 0;color:var(--muted)}a{color:var(--accent)}button,input,.button{font:inherit;padding:9px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg)}a.button{text-decoration:none;display:inline-block}a.button:hover{border-color:var(--accent)}a:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}input{width:100%;margin-bottom:22px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:20px}article{padding:22px;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow-wrap:anywhere}.tag{font:12px var(--mono);display:inline-block;background:var(--raised);border-radius:4px;padding:1px 7px;margin:2px}.actions{display:flex;gap:12px;align-items:center;margin-top:22px}time,small{font:13px var(--mono);color:var(--muted)}#notice{white-space:pre-wrap}footer{margin-top:32px;color:var(--muted);font-size:14px}
body.preview{height:100vh;display:flex;flex-direction:column;overflow:hidden}.preview header{max-width:none;margin:0;padding:3px 10px;gap:10px;flex-wrap:nowrap;font-size:13px;line-height:1.4;background:var(--crust);border-bottom:1px solid var(--line)}.preview h1{flex:1;min-width:0;font-size:13px;font-weight:600;letter-spacing:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview a{white-space:nowrap;text-decoration:none}.preview a.button{padding:1px 8px;border-radius:4px;color:var(--accent)}iframe{display:block;flex:1;width:100%;border:0;background:var(--bg)}
`;
// Inline so it passes the gallery CSP (img-src data:) without an extra route.
const favicon = `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,${encodeURIComponent(
	`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#cba6f7"/><path d="M8 5h11l5 5v17H8z" fill="#1e1e2e"/><path d="M19 5v5h5M12 14h8M12 18h8M12 22h5" fill="none" stroke="#cba6f7" stroke-width="2" stroke-linecap="round"/></svg>`,
)}">`;
export function gallery(): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent artifacts</title>${favicon}<style>${css}</style></head><body><header><div><h1>Agent artifacts</h1><p>Local, interactive work. Nothing uploaded.</p></div><small id="count" aria-live="polite"></small></header><main><label for="search">Find an artifact</label><input id="search" type="search" placeholder="Search titles, descriptions, or tags"><p id="notice" role="status"></p><div class="grid" id="artifacts"></div><footer>ZIP archives contain standalone offline HTML and editable source. Review contents before sharing.</footer></main><script>
const grid=document.getElementById('artifacts'),search=document.getElementById('search'),notice=document.getElementById('notice');
let artifacts=[],last='';
function node(tag,text){const el=document.createElement(tag);if(text)el.textContent=text;return el}
function render(){
const query=search.value.toLowerCase();
const visible=artifacts.filter(a=>[a.title,a.description,...a.tags].join(' ').toLowerCase().includes(query));grid.replaceChildren();
for(const artifact of visible){
const card=node('article');const date=node('time',new Date(artifact.createdAt).toLocaleString());date.dateTime=artifact.createdAt;card.append(date,node('h2',artifact.title),node('p',artifact.description));
const tags=node('div');for(const tag of artifact.tags){const chip=node('span',tag);chip.className='tag';tags.append(chip)}card.append(tags);
const actions=node('div');actions.className='actions';const open=node('a','Open');open.href='/artifacts/'+artifact.id;open.className='button';const download=node('a','Download ZIP');download.href='/api/artifacts/'+artifact.id+'/archive';download.download=artifact.id+'.zip';actions.append(open,download);card.append(actions);grid.append(card);
}
if(!visible.length)grid.append(node('p',query?'No matching artifacts.':'No artifacts yet. Submit one with agent-artifacts submit <project>.'));
}
async function refresh(){try{const response=await fetch('/api/artifacts');if(!response.ok)throw Error('Host returned '+response.status);const state=await response.json();const serialized=JSON.stringify(state.artifacts);if(last!==serialized){artifacts=state.artifacts;last=serialized;render()}document.getElementById('count').textContent=artifacts.length+' artifacts';notice.textContent=(state.queued?'Waiting to ingest: '+state.queued+'. ':'')+(state.failed?'Rejected submissions: '+state.failed+'. Run agent-artifacts status <id> for details.':'');}catch(error){notice.textContent='Unable to refresh: '+error.message}}
search.addEventListener('input',render);refresh();setInterval(refresh,2000);
</script></body></html>`;
}
export function preview(id: string, title: string): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Agent artifacts</title>${favicon}<style>${css}</style></head><body class="preview"><header><a href="/">← All artifacts</a><h1>${escapeHtml(title)}</h1><a class="button" href="/api/artifacts/${id}/archive" download>Download ZIP</a></header><iframe title="${escapeHtml(title)}" sandbox="allow-scripts allow-downloads" src="/content/${id}/index.html" allow="clipboard-write"></iframe></body></html>`;
}
