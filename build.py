"""index.html에 src/ 의 CSS·JS(village-ai, cloud, village3d)를 넣는다(여러 번 실행해도 같은 결과).
사용법: python3 build.py
"""
import re, json, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'src/village-ai.css').read_text(encoding='utf-8')
js = (root / 'src/village-ai.js').read_text(encoding='utf-8')
cloud = (root / 'src/cloud.js').read_text(encoding='utf-8')
v3d = (root / 'src/village3d.js').read_text(encoding='utf-8')
guide = json.loads((root / 'src/plan-guide.json').read_text(encoding='utf-8'))
guide_js = 'window.PPP_PLAN_GUIDE=' + json.dumps(guide, ensure_ascii=False).replace('<', '\\u003c') + ';'
IMPORTMAP = '<script type="importmap" id="village-importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/"}}</script>'

html = re.sub(r'\n?<style id="village-ai-style">.*?</style>', '', html, flags=re.S)
for sid in ('plan-guide-js', 'village-ai-js', 'cloud-js', 'village-3d', 'village-importmap'):
    html = re.sub(r'\n?<script[^>]*id="' + sid + r'"[^>]*>.*?</script>', '', html, flags=re.S)
html = html.replace('</head>', f'<style id="village-ai-style">\n{css}</style>\n{IMPORTMAP}\n</head>', 1)
i = html.rfind('</body>')
html = (html[:i] + f'<script id="plan-guide-js">\n{guide_js}\n</script>\n' + f'<script id="village-ai-js">\n{js}</script>\n<script id="cloud-js">\n{cloud}</script>\n'
        + f'<script type="module" id="village-3d">\n{v3d}</script>\n' + html[i:])

# 시연 사례(김하니)에 아바타를 입힌다.
m = re.search(r'(<script id="snapshotState" type="application/json">)(.*?)(</script>)', html, re.S)
if m:
    data = json.loads(m.group(2))
    for u in data.get('users', []):
        if u.get('name') == '김하니' and 'avatar' not in u:
            u['avatar'] = {'skin': '#f8d9c0', 'hair': 'bob', 'hairColor': '#2d2420', 'outfit': '#c4566e', 'acc': 'ribbon', 'face': 'grin'}
    body = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    html = html[:m.start(2)] + body + html[m.end(2):]

(root / 'index.html').write_text(html, encoding='utf-8')
print('built index.html', len(html))
