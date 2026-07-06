from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('out/products')
pub = Path('public/products')
upload = Path(r'C:\Users\Administrator\Pictures\tzqz-upload')
upload.mkdir(parents=True, exist_ok=True)

handles = sorted([p.name for p in root.glob('tz-qz-*') if p.is_dir()])
font = ImageFont.load_default()
count = 0
for h in handles:
    img = Image.new('RGB', (1200, 1200), (235, 235, 235))
    d = ImageDraw.Draw(img)
    title = h.upper()
    d.rectangle((120, 460, 1080, 740), outline=(80,80,80), width=4)
    d.text((180, 520), 'YBB PLACEHOLDER', fill=(30,30,30), font=font)
    d.text((180, 580), title, fill=(30,30,30), font=font)
    for base in (root, pub):
        out = base / h / 'master.webp'
        out.parent.mkdir(parents=True, exist_ok=True)
        img.save(out, 'WEBP', quality=86)
    img.save(upload / f'{h}.webp', 'WEBP', quality=86)
    count += 1
print('regenerated', count)
