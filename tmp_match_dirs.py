import json
from pathlib import Path
root = Path(r"E:\Ñ¸À×ÔÆÅÌ\²úÆ·Ô­Í¼ËØ²Ä")
catalog = json.loads(Path('deploy/product-import/wc-catalog.json').read_text(encoding='utf-8'))
parents = [(p['parentSku'], p.get('nameZh','')) for p in catalog['products'] if str(p.get('parentSku','')).startswith('TZ-QZ-')]
dirs = [d.name for d in root.iterdir() if d.is_dir()]
for sku,name in parents:
    hits = [d for d in dirs if name and name in d]
    print(sku, name, len(hits), hits[:3])
