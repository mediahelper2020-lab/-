"""index.html에 src/village-ai.css · src/village-ai.js 를 넣는다(여러 번 실행해도 같은 결과).
사용법: python3 build.py
"""
import re, json, pathlib
root = pathlib.Path(__file__).parent
html = (root / 'index.html').read_text(encoding='utf-8')
css = (root / 'src/village-ai.css').read_text(encoding='utf-8')
js = (root / 'src/village-ai.js').read_text(encoding='utf-8')

html = re.sub(r'\n?<style id="village-ai-style">.*?</style>', '', html, flags=re.S)
html = re.sub(r'\n?<script id="village-ai-js">.*?</script>', '', html, flags=re.S)
html = html.replace('</head>', f'<style id="village-ai-style">\n{css}</style>\n</head>', 1)
i = html.rfind('</body>')
html = html[:i] + f'<script id="village-ai-js">\n{js}</script>\n' + html[i:]

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
