from openpyxl import load_workbook
from pathlib import Path
wb = load_workbook(Path.home() / 'Desktop' / '产品表单.xlsx')
ws = wb['铅坠']
rows = []
for img in ws._images:
    a = getattr(img, 'anchor', None)
    m = getattr(a, '_from', None)
    if m is not None:
        rows.append((m.row + 1, m.col + 1, getattr(img, 'path', '')))
print('count', len(ws._images))
print(rows[:30])
