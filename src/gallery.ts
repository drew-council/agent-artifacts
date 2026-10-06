export function escapeHtml(value: string): string {
	return value.replace(
		/[&<>"']/g,
		(char) =>
			({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
				char
			] ?? char,
	);
}
const css = `
:root{color-scheme:light dark;--bg:#faf9f6;--fg:#202428;--muted:#657078;--line:#dce1df;--surface:#fff;--accent:#176957}
@media(prefers-color-scheme:dark){:root{--bg:#131a1c;--fg:#e9efed;--muted:#a1b1ac;--line:#34423e;--surface:#1e2825;--accent:#99dbc4}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:17px/1.6 system-ui,sans-serif}main,header{max-width:1100px;margin:auto;padding:28px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}h1{font-size:clamp(28px,4vw,42px);letter-spacing:-.04em;margin:0}h2{font-size:23px;line-height:1.3;margin:10px 0}p{margin:8px 0;color:var(--muted)}a{color:var(--accent)}button,input,.button{font:inherit;padding:9px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--fg)}a.button{text-decoration:none;display:inline-block}a:focus-visible,input:focus-visible{outline:3px solid var(--accent);outline-offset:3px}input{width:100%;margin-bottom:22px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(300px,100%),1fr));gap:20px}article{padding:22px;border:1px solid var(--line);border-radius:8px;background:var(--surface);overflow-wrap:anywhere}.tag{font-size:13px;display:inline-block;background:var(--bg);border:1px solid var(--line);border-radius:4px;padding:1px 7px;margin:2px}.actions{display:flex;gap:12px;align-items:center;margin-top:22px}time,small{font-size:13px;color:var(--muted)}iframe{display:block;width:100%;height:calc(100vh - 110px);border:0;background:var(--surface)}.preview-header{max-width:none;padding:16px 24px}.preview-header h1{font-size:20px}#notice{white-space:pre-wrap}footer{margin-top:32px;color:var(--muted);font-size:14px}
`;
export function gallery(): string {
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Agent artifacts</title><style>${css}</style></head><body><header><div><h1>Agent artifacts</h1><p>Local, interactive work. Nothing uploaded.</p></div><small id="count" aria-live="polite"></small></header><main><label for="search">Find an artifact</label><input id="search" type="search" placeholder="Search titles, descriptions, or tags"><p id="notice" role="status"></p><div class="grid" id="artifacts"></div><footer>ZIP archives contain standalone offline HTML and editable source. Review contents before sharing.</footer></main><script>
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
	return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Agent artifacts</title><style>${css}</style></head><body><header class="preview-header"><a href="/">← All artifacts</a><h1>${escapeHtml(title)}</h1><a class="button" href="/api/artifacts/${id}/archive" download>Download ZIP</a></header><iframe title="${escapeHtml(title)}" sandbox="allow-scripts allow-downloads" src="/content/${id}/index.html" allow="clipboard-write"></iframe></body></html>`;
}
